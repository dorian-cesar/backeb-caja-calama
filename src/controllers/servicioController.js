const pool = require('../../db_config/db.js');
require('dotenv').config(); 

exports.obtenerServiciosActivos = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT tipo, precio FROM servicios WHERE estado = "activo"'
    );
    res.json({ success: true, servicios: rows });
  } catch (err) {
    console.error('Error al obtener servicios:', err);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
};
