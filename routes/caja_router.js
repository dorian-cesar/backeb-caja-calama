const express = require('express');
const router = express.Router();
const cajaController = require('../src/controllers/cajaController');
const servicioController = require('../src/controllers/servicioController');

router.get('/api/numero-caja', (req, res) => {
    try {
        const numero_caja = parseInt(process.env.NUMERO_CAJA) || 1;
        res.json({ numero_caja: numero_caja });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener número de caja' });
    }
});

// Ruta para imprimir comprobante de retiro
router.post('/api/caja/imprimir-retiro', cajaController.imprimirComprobanteRetiro);

router.post('/api/caja/retiros', cajaController.registrarRetiro);

// Rutas para abrir caja
router.post('/api/caja/abrir', cajaController.abrirCaja);

router.get('/api/caja/abierta', cajaController.listarCajaAbierta);

router.get('/api/caja/abierta-por-usuario', cajaController.cargarCajaAbiertaPorUsuario);


// Rutas para los movimientos
router.post('/api/caja/movimientos', cajaController.registrarMovimiento);

// /api/caja/movimientos?id_usuario=${id_usuario}
router.get('/api/caja/movimientos/por-usuario', cajaController.listarMovimientosPorUsuario);

// /api/caja/movimientos?numero_caja=${numeroCaja}
router.get('/api/caja/movimientos/por-caja', cajaController.listarMovimientosPorCaja);


// Ruta para cerrar caja
router.post('/api/caja/cerrar', cajaController.cerrarCaja);

router.get('/api/caja/cajas-dia', cajaController.listarCajasDelDia);

router.get('/api/servicios', servicioController.obtenerServiciosActivos);

module.exports = router;
