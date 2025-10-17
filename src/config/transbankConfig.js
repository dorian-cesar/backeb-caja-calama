const config = {
  protocol: process.env.TBK_PROTOCOL || 'USB',
  portPath: process.env.TBK_PORT_PATH, 
  baudRate: parseInt(process.env.TBK_BAUD_RATE),
  timeout: parseInt(process.env.TBK_TIMEOUT) || 150000, // 15 segundos
  merchantCode: process.env.TBK_COMMERCE_CODE,
  terminalId: process.env.TBK_TERMINAL_ID,
  enableLogs: process.env.TBK_ENABLE_LOGS === 'false',
  maxRetries: parseInt(process.env.TBK_MAX_RETRIES) || 3
};

// Validación de parámetros obligatorios
if (!config.portPath) throw new Error('TBK_PORT_PATH no está configurado');
if (!config.baudRate) throw new Error('TBK_BAUD_RATE no está configurado');
if (!config.timeout) throw new Error('TBK_TIMEOUT no está configurado');
if (!config.merchantCode) throw new Error('TBK_COMMERCE_CODE no está configurado');
if (!config.terminalId) throw new Error('TBK_TERMINAL_ID no está configurado');

module.exports = config;