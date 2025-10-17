const { POSAutoservicio } = require('transbank-pos-sdk');
const autoReconnectPOS = require('../utils/posReconnect');

class TransbankService {
  constructor() {
    this.pos = new POSAutoservicio();
    this.connectedPort = null;
    this._monitorInterval = null;
    this._isMonitoring = false;
    this.pos.setDebug(false);
  }

  async reconnectIfNeeded(maxRetries = 5, delayMs = 500) {
    let attempt = 0;
    while (!this.deviceConnected && attempt < maxRetries) {
      attempt++;
      console.warn(`POS desconectado, intentando reconexión (${attempt}/${maxRetries})...`);
      try {
        const reconnected = await autoReconnectPOS(this);
        if (reconnected) return true;
        await new Promise(r => setTimeout(r, delayMs));
      } catch (error) {
        console.warn(`⚠️ Error en reconexión (intento ${attempt}):`, error.message);
      }
    }
    if (!this.deviceConnected) {
      console.warn('⚠️ No se pudo reconectar al POS, pero el servidor continúa funcionando');
      return false;
    }
    return true;
  }

  async connectToPort(portPath) {
    try {
      const response = await this.pos.connect(portPath);
      this.connectedPort = { path: portPath, ...response };
      console.log(`✅ Conectado manualmente al puerto ${portPath}`);
      return response;
    } catch (error) {
      console.error(`❌ Error conectando a ${portPath}:`, error.message);
      throw error;
    }
  }

  async listAvailablePorts() {
    try {
      const ports = await this.pos.listPorts();
      return ports.map(port => ({
        path: port.path,
        manufacturer: port.manufacturer || 'Desconocido'
      }));
    } catch (error) {
      console.error('❌ Error listando puertos:', error.message);
      return [];
    }
  }

  async enviarVenta(amount, ticketNumber) {
    try {
      await this.reconnectIfNeeded();

      const ticket = ticketNumber.padEnd(20, '0').substring(0, 20);
      const response = await this.pos.sale(amount, ticket);
      console.log(`✅ Venta enviada - Operación: ${response.operationNumber}`);
      return response;
    } catch (error) {
      const pending = error.message.includes('still waiting for a response');
      const timeout = error.message.includes('not been received');

      if (pending || timeout) {
        console.warn('⚠️ Estado bloqueado por transacción anterior. Reiniciando conexión...');
        await this.closeConnection();
        await this.reconnectIfNeeded();
      }

      console.error('❌ Error durante la venta:', error);
      throw error;
    }
  }

  async enviarVentaReversa(amount, originalOperationNumber) {
    try {
      const ticket = originalOperationNumber.padEnd(20, '0').substring(0, 20);
      const response = await this.pos.refund(amount, ticket, false);
      console.log(`✅ Reversa exitosa - Operación: ${response.operationNumber}`);
      return response;
    } catch (error) {
      console.error('❌ Error durante la reversa:', error);
      throw error;
    }
  }

  async getLastTransaction() {
    try {
      const response = await this.pos.getLastSale();
      console.debug('📋 Respuesta completa del POS:', JSON.stringify(response, null, 2));
      return {
        success: true,
        message: 'Transacción obtenida correctamente',
        data: {
          approved: response.successful,
          responseCode: response.responseCode === 0 ? '00' : 'UNKNOWN',
          operationNumber: response.operationNumber,
          amount: response.amount,
          cardNumber: response.last4Digits ? `••••${response.last4Digits}` : null,
          authorizationCode: response.authorizationCode,
          timestamp: response.realDate && response.realTime
            ? `${response.realDate} ${response.realTime}`
            : null,
          cardType: response.cardType,
          cardBrand: response.cardBrand,
          rawData: response
        }
      };
    } catch (error) {
      console.error('❌ Error al obtener última transacción:', error);
      throw error;
    }
  }

  async sendCloseCommand(printReport = true) {
    try {
      const response = await this.pos.closeDay({ printOnPos: printReport }, false);
      console.log('✅ Cierre de terminal exitoso');
      return response;
    } catch (error) {
      console.error('❌ Error durante el cierre de terminal:', error);
      throw error;
    }
  }

  async loadKey() {
    try {
      await this.pos.loadKeys();
      console.log('🔐 Inicialización del terminal completada (llaves cargadas)');
      return { success: true, message: 'Llaves cargadas correctamente' };
    } catch (error) {
      console.error('❌ Error al inicializar terminal (cargar llaves):', error);
      throw error;
    }
  }

  get deviceConnected() {
    return this.connectedPort !== null;
  }

  get connection() {
    return this.connectedPort;
  }

  async closeConnection() {
    if (this.connectedPort) {
      try {
        await this.pos.disconnect();
        console.log('🔌 Conexión con POS cerrada correctamente');
      } catch (error) {
        console.error('❌ Error al cerrar conexión con POS:', error.message);
      } finally {
        this.connectedPort = null;
      }
    } else {
      console.warn('⚠️ No hay conexión activa que cerrar');
    }
  }

  // 🔍 Monitoreo automático de conexión USB - MEJORADO
  startAutoMonitor() {
    if (this._monitorInterval) {
      console.log('🟡 Monitoreo automático ya está activo');
      return;
    }
    
    console.log('🟡 Monitoreo automático del POS iniciado...');
    this._isMonitoring = true;

    this._monitorInterval = setInterval(async () => {
      // ⚠️ IMPORTANTE: Capturar cualquier error no manejado
      try {
        if (!this._isMonitoring) return;

        const ports = await this.listAvailablePorts();
        const available = ports.map(p => p.path.toUpperCase());
        const expectedPorts = process.env.TBK_PORT_PATH
          ? process.env.TBK_PORT_PATH.split(',').map(p => p.trim().toUpperCase())
          : [];

        // 🔴 Si POS estaba conectado pero ahora el puerto no aparece
        if (this.deviceConnected && !available.includes(this.connectedPort.path.toUpperCase())) {
          console.warn(`⚠️ Puerto ${this.connectedPort.path} desconectado físicamente. Reconectando...`);
          await this.handlePhysicalDisconnect(expectedPorts);
        }

        // 🟢 Si POS estaba desconectado, intentar reconectar automáticamente
        if (!this.deviceConnected) {
          console.log('🟡 POS desconectado, intentando reconexión automática...');
          await this.handlePhysicalDisconnect(expectedPorts);
        }

      } catch (err) {
        // ✅ CAPTURAR ERRORES PARA EVITAR QUE EL SERVIDOR SE CAIGA
        console.error('❌ Error en monitoreo automático (continuando):', err.message);
      }
    }, 5000); // 👈 Intervalo de 5 segundos (más razonable)
  }

  async handlePhysicalDisconnect(preferredPorts) {
    this.connectedPort = null;
    
    for (const port of preferredPorts) {
      try {
        await this.pos.connect(port);
        this.connectedPort = { path: port };
        console.log(`✅ POS reconectado automáticamente en ${port}`);
        await this.loadKey();
        return true;
      } catch (err) {
        console.warn(`❌ Falló reconexión en ${port}: ${err.message}`);
      }
    }

    console.log('⏳ POS desconectado. Se reintentará en el próximo ciclo.');
    return false;
  }

  stopAutoMonitor() {
    this._isMonitoring = false;
    if (this._monitorInterval) {
      clearInterval(this._monitorInterval);
      this._monitorInterval = null;
      console.log('🟢 Monitoreo automático detenido.');
    }
  }

  // Método para verificar estado sin lanzar errores
  async safeCheckStatus() {
    try {
      return {
        connected: this.deviceConnected,
        port: this.connection?.path || null,
        monitoring: this._isMonitoring
      };
    } catch (error) {
      return {
        connected: false,
        port: null,
        monitoring: false,
        error: error.message
      };
    }
  }

  // Método seguro para obtener información del POS
  async getSafeStatus() {
    try {
      if (!this.deviceConnected) {
        return {
          connected: false,
          port: null,
          message: 'POS desconectado'
        };
      }

      // Intentar obtener última transacción para verificar funcionamiento
      try {
        const lastTx = await this.getLastTransaction();
        return {
          connected: true,
          port: this.connection?.path,
          lastTransaction: lastTx.data,
          message: 'POS conectado y funcionando'
        };
      } catch (txError) {
        return {
          connected: true,
          port: this.connection?.path,
          message: 'POS conectado pero error en comunicación',
          error: txError.message
        };
      }
    } catch (error) {
      return {
        connected: false,
        port: null,
        message: 'Error verificando estado del POS',
        error: error.message
      };
    }
  }
}

module.exports = new TransbankService();