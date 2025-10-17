const logger = require('./logger');

async function autoReconnectPOS(serviceInstance) {
  try {
    const preferredPorts = process.env.TBK_PORT_PATH
      ? process.env.TBK_PORT_PATH.split(',').map(p => p.trim().toUpperCase())
      : [];

    // Intentar puertos preferidos
    for (const port of preferredPorts) {
      try {
        await serviceInstance.connectToPort(port);
        logger.info(`✅ POS reconectado en puerto preferido: ${port}`);
        return true;
      } catch (err) {
        logger.warn(`⚠️ Falló reconexión en puerto preferido (${port}): ${err.message}`);
      }
    }

    // Intentar puertos disponibles
    try {
      const allPorts = await serviceInstance.listAvailablePorts();
      const availablePorts = allPorts.filter(p => 
        p.path.includes('COM') || p.path.includes('ACM')
      );
      
      for (const port of availablePorts) {
        if (preferredPorts.includes(port.path.toUpperCase())) continue;
        try {
          await serviceInstance.connectToPort(port.path);
          logger.info(`✅ POS reconectado en puerto alternativo: ${port.path}`);
          return true;
        } catch (err) {
          logger.warn(`❌ No se pudo reconectar por ${port.path}: ${err.message}`);
        }
      }
    } catch (error) {
      logger.error(`❌ Error listando puertos para reconexión: ${error.message}`);
    }

    return false;
  } catch (error) {
    logger.error(`❌ Error en autoReconnectPOS: ${error.message}`);
    return false;
  }
}

module.exports = autoReconnectPOS;