require('dotenv').config();

const fs = require('fs');
const path = require('path');
const express = require('express');
const session = require('express-session');

// -------- instancia Express principal creada en src/app.js --------
const app = require('./src/app'); // mantiene todas las rutas /api/ para transbank


// estáticos para la interfaz de caja
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'views')));

// Redirección según sesión
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'home.html'));
});

// ----------------- lógica de conexión y monitor POS -----------------
const transbankService = require('./src/services/transbankService');

const PORT = process.env.PORT || 3000;
const ENV = process.env.NODE_ENV || 'development';
const MAX_RETRIES = parseInt(process.env.TBK_CONNECTION_RETRIES || '10', 10);
const RETRY_DELAY = parseInt(process.env.TBK_RETRY_DELAY_MS || '5000', 10);

async function connectToPOS() {
  let attempt = 0;
  let connected = false;

  const preferredPorts = process.env.TBK_PORT_PATH
    ? process.env.TBK_PORT_PATH.split(',').map(p => p.trim().toUpperCase())
    : [];

  while (attempt < MAX_RETRIES && !connected) {
    attempt++;
    try {
      console.log(`🔁 Intento ${attempt} de conexión al POS...`);
      await transbankService.closeConnection().catch(() => {});

      // 1️⃣ Intentar con puertos preferidos
      for (const portName of preferredPorts) {
        try {
          console.log(`🔌 Probando puerto preferido: ${portName}`);
          await transbankService.connectToPort(portName);
          console.log(`✅ POS conectado a puerto preferido: ${portName}`);
          connected = true;
          break;
        } catch (err) {
          console.warn(`⚠️ Falló puerto ${portName}: ${err.message}`);
        }
      }

      // 2️⃣ Si no conectó, buscar puertos ACM alternativos
      if (!connected) {
        const allPorts = await transbankService.listAvailablePorts();
        const acmPorts = allPorts.filter(p => p.path.includes('ACM'));

        for (const port of acmPorts) {
          if (preferredPorts.includes(port.path.toUpperCase())) continue;
          try {
            console.log(`🔌 Probando puerto alternativo: ${port.path}`);
            await transbankService.connectToPort(port.path);
            console.log(`✅ POS conectado a puerto alternativo: ${port.path}`);
            connected = true;
            break;
          } catch (err) {
            console.warn(`⚠️ Falló conexión a ${port.path}: ${err.message}`);
          }
        }
      }

      // 3️⃣ Si se logró conectar, cargar llaves y arrancar monitor
      if (connected) {
        await transbankService.loadKey();
        console.log('🔐 Llaves cargadas correctamente');
        transbankService.startAutoMonitor(); // ✅ inicia monitor automático
        return true;
      }

      // 4️⃣ Si falló, esperar y reintentar
      if (attempt < MAX_RETRIES) {
        console.log(`⏳ Reintentando en ${RETRY_DELAY / 1000}s...`);
        await new Promise(r => setTimeout(r, RETRY_DELAY));
      }
    } catch (err) {
      console.error(`❌ Error en intento ${attempt}: ${err.message}`);
      if (attempt < MAX_RETRIES) {
        await new Promise(r => setTimeout(r, RETRY_DELAY));
      }
    }
  }

  if (!connected) {
    console.error(`🚫 No se logró conectar al POS tras ${MAX_RETRIES} intentos`);
  }
}

// ---------------------- servidor HTTP + shutdown -------------------
async function startServer() {
  try {
    console.log(`Iniciando servidor en modo ${ENV}`);

    // Primero conectamos al POS antes de levantar el servidor
    await connectToPOS();

    const server = app.listen(PORT, () => {
      console.log(`✅ Servidor HTTP activo en http://localhost:${PORT}`);
    });

    // apagado ordenado
    const shutdown = async signal => {
      console.log(`→ señal ${signal}. Cerrando…`);
      try {
        await Promise.race([
          new Promise(resolve => server.close(resolve)),
          new Promise((_, rej) => setTimeout(() => rej(new Error('Timeout al cerrar servidor')), 5000))
        ]);
        console.log('Servidor cerrado');
        await transbankService.closeConnection();
        console.log('Conexión POS cerrada');
      } catch (e) {
        console.error('Error en shutdown:', e.message);
      } finally {
        process.exit(0);
      }
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('uncaughtException', err => {
      console.error('❌ uncaughtException:', err);
      shutdown('uncaughtException');
    });
    process.on('unhandledRejection', (reason) => {
      console.error('❌ unhandledRejection:', reason);
      shutdown('unhandledRejection');
    });

  } catch (fatal) {
    console.error('Error crítico al iniciar:', fatal.message);
    process.exit(1);
  }
}

startServer();