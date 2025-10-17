const { POSAutoservicio } = require('transbank-pos-sdk');
const autoReconnectPOS = require('../utils/posReconnect');

class TransbankService {
  constructor() {
    this.pos = new POSAutoservicio();
    this.connectedPort = null;
    this._monitorInterval = null;
    this.pos.setDebug(false);
  }

  async reconnectIfNeeded(maxRetries = 5, delayMs = 500) {
    let attempt = 0;
    while (!this.deviceConnected && attempt < maxRetries) {
      attempt++;
      console.warn(`POS desconectado, intentando reconexión (${attempt}/${maxRetries})...`);
      const reconnected = await autoReconnectPOS(this);
      if (reconnected) return true;
      await new Promise(r => setTimeout(r, delayMs));
    }
    if (!this.deviceConnected) {
      throw new Error('No se pudo reconectar al POS después de varios intentos');
    }
  }

  async connectToPort(portPath) {
    const response = await this.pos.connect(portPath);
    this.connectedPort = { path: portPath, ...response };
    console.log(`Conectado manualmente al puerto ${portPath}`);
    return response;
  }

  async listAvailablePorts() {
    const ports = await this.pos.listPorts();
    return ports.map(port => ({
      path: port.path,
      manufacturer: port.manufacturer || 'Desconocido'
    }));
  }

  async enviarVenta(amount, ticketNumber) {
    try {
      await this.reconnectIfNeeded();

      const ticket = ticketNumber.padEnd(20, '0').substring(0, 20);
      const response = await this.pos.sale(amount, ticket);
      console.log(`Venta enviada - Operación: ${response.operationNumber}`);
      return response;
    } catch (error) {
      const pending = error.message.includes('still waiting for a response');
      const timeout = error.message.includes('not been received');

      if (pending || timeout) {
        console.warn('⚠️ Estado bloqueado por transacción anterior. Reiniciando conexión...');
        await this.closeConnection();
        await this.reconnectIfNeeded();
      }

      console.error('Error durante la venta:', error);
      throw error;
    }
  }

  async enviarVentaReversa(amount, originalOperationNumber) {
    try {
      const ticket = originalOperationNumber.padEnd(20, '0').substring(0, 20);
      const response = await this.pos.refund(amount, ticket, false);
      console.log(`Reversa exitosa - Operación: ${response.operationNumber}`);
      return response;
    } catch (error) {
      console.error('Error durante la reversa:', error);
      throw error;
    }
  }

  async getLastTransaction() {
    try {
      const response = await this.pos.getLastSale();
      console.debug('Respuesta completa del POS:', JSON.stringify(response, null, 2));
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
      console.error('Error al obtener última transacción:', error);
      throw error;
    }
  }

  async sendCloseCommand(printReport = true) {
    try {
      const response = await this.pos.closeDay({ printOnPos: printReport }, false);
      console.log('Cierre de terminal exitoso');
      return response;
    } catch (error) {
      console.error('Error durante el cierre de terminal:', error);
      throw error;
    }
  }

  async loadKey() {
    try {
      await this.pos.loadKeys();
      console.log('Inicialización del terminal completada (llaves cargadas)');
      return { success: true, message: 'Llaves cargadas correctamente' };
    } catch (error) {
      console.error('Error al inicializar terminal (cargar llaves):', error);
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
        console.log('Conexión con POS cerrada correctamente');
      } catch (error) {
        console.error('Error al cerrar conexión con POS:', error.message);
      } finally {
        this.connectedPort = null;
      }
    } else {
      console.warn('No hay conexión activa que cerrar');
    }
  }

  // 🔍 Monitoreo automático de conexión USB
  startAutoMonitor() {
    if (this._monitorInterval) return; // evitar múltiples monitores
    console.log('🟡 Monitoreo automático del POS iniciado...');

    this._monitorInterval = setInterval(async () => {
      try {
        const ports = await this.pos.listPorts();
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
          await this.handlePhysicalDisconnect(expectedPorts);
        }

      } catch (err) {
        console.error('Error monitoreando conexión POS:', err.message);
      }
    }, 1000); // 👈 intervalo más corto para reacción inmediata
  }

  async handlePhysicalDisconnect(preferredPorts) {
    this.connectedPort = null;
    for (const port of preferredPorts) {
      try {
        await this.pos.connect(port);
        this.connectedPort = { path: port };
        console.log(`✅ POS reconectado automáticamente en ${port}`);
        await this.loadKey();
        return true; // éxito
      } catch (err) {
        console.warn(`❌ Falló reconexión en ${port}: ${err.message}`);
      }
    }

    console.warn('⏳ No se pudo reconectar el POS. Se seguirá intentando en el próximo ciclo.');
    return false; // falló
  }

  stopAutoMonitor() {
    if (this._monitorInterval) {
      clearInterval(this._monitorInterval);
      this._monitorInterval = null;
      console.log('🟢 Monitoreo automático detenido.');
    }
  }
}

module.exports = new TransbankService();