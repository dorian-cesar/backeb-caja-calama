const transbankService = require('../services/transbankService');
const responseHandler = require('../utils/responseHandler');
const autoReconnectPOS = require('../utils/posReconnect');
const logger = require('../utils/logger');

const POLLING_INTERVAL_MS = 600000; // 10 minutos

let monitorActive = false;

async function startPOSMonitor() {
  if (monitorActive) return;
  monitorActive = true;

  setInterval(async () => {
    try {
      if (!transbankService.deviceConnected) {
        await autoReconnectPOS();
      }
    } catch (error) {
      
    }
  }, POLLING_INTERVAL_MS);
}

exports.startHealthMonitor = async (req, res) => {
  try {
    await startPOSMonitor();
    responseHandler.success(res, 'Monitor de salud del POS iniciado');
  } catch (error) {
    logger.error('Error al iniciar monitor de salud:', error);
    responseHandler.error(res, error.message, 500, 'MONITOR_START_ERROR');
  }
};

exports.startPOSMonitor = startPOSMonitor;

exports.closeTerminal = async (req, res) => {
  try {
    const { printReport = true } = req.body;
    const result = await transbankService.sendCloseCommand(printReport);
    responseHandler.success(res, 'Cierre de terminal exitoso', result);
  } catch (error) {
    logger.error('Error en cierre de terminal:', error);
    responseHandler.error(res, error.message, 500, error.responseCode || 'UNKNOWN');
  }
};

exports.loadKey = async (req, res) => {
  try {
    const result = await transbankService.loadKey();
    responseHandler.success(res, 'Inicialización del terminal completada', result);
  } catch (error) {
    logger.error('Error inicializando terminal:', error);
    responseHandler.error(res, error.message, 500, error.responseCode || 'UNKNOWN');
  }
};

exports.getLastTransaction = async (req, res) => {
  try {
    const result = await transbankService.getLastTransaction();
    responseHandler.success(res, result.message, result.data);
  } catch (error) {
    logger.error('Error:', error);
    responseHandler.error(res, 'Error al obtener la transacción', 500);
  }
};

exports.listPorts = async (req, res) => {
  try {
    const ports = await transbankService.listAvailablePorts();
    responseHandler.success(res, 'Puertos disponibles', ports);
  } catch (error) {
    logger.error('Error al listar puertos:', error);
    responseHandler.error(res, error.message, 500, 'PORTS_LIST_ERROR');
  }
};

exports.conectarPuerto = async (req, res) => {
  try {
    const portPath = req.body.portPath || process.env.TBK_PORT_PATH;

    if (!portPath) {
      return responseHandler.error(res, 'Debe proporcionar un puerto válido', 400, 'MISSING_PORT');
    }

    // Cerrar conexión existente si hay una
    if (transbankService.deviceConnected) {
      await transbankService.closeConnection();
    }

    // Intentar conexión directa
    const result = await transbankService.connectToPort(portPath);
    responseHandler.success(res, `Conectado al puerto ${portPath}`, result);
    
  } catch (error) {
    logger.error('Error al conectar al puerto:', error);
    
    let errorCode = 'PORT_CONNECT_ERROR';
    let userMessage = error.message;
    
    if (error.message.includes('permission denied')) {
      errorCode = 'PORT_PERMISSION_DENIED';
      userMessage = 'Error de permisos en el puerto. Contacte al administrador';
    } else if (error.message.includes('not found')) {
      errorCode = 'PORT_NOT_FOUND';
      userMessage = 'Puerto no encontrado. Verifique la conexión física del POS';
    }
    
    responseHandler.error(res, userMessage, 500, errorCode);
  }
};

exports.statusPos = async (req, res) => {
  try {
    responseHandler.success(res, 'Estado del POS', {
      connected: transbankService.deviceConnected,
      port: transbankService.connection?.path || null
    });
  } catch (error) {
    logger.error('Error al obtener estado de conexión:', error);
    responseHandler.error(res, error.message, 500, 'STATUS_ERROR');
  }
};

exports.autoReconnectPOS = autoReconnectPOS;