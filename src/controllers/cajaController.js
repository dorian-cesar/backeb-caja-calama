const pool = require('../../db_config/db.js');
require('dotenv').config(); 
const { imprimirCierreCaja, imprimirRetiro } = require('../services/printService');


exports.abrirCaja = async (req, res) => {
  const { monto_inicial, observaciones, id_usuario_apertura } = req.body;
  const NUMERO_CAJA = parseInt(process.env.NUMERO_CAJA); // número de caja desde .env

  // Validaciones
  if (!monto_inicial || isNaN(monto_inicial) || parseFloat(monto_inicial) <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Monto inicial inválido. Debe ser un número mayor a 0.',
    });
  }

  if (!id_usuario_apertura || isNaN(id_usuario_apertura)) {
    return res.status(400).json({
      success: false,
      error: 'ID de usuario inválido',
    });
  }

  const fecha = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const hora = new Date().toTimeString().slice(0, 8);   // HH:MM:SS

  try {
    // Validar que la caja exista y esté activa
    const [cajaData] = await pool.execute(
      'SELECT numero_caja FROM cajas WHERE numero_caja = ? AND estado = "activa" LIMIT 1',
      [NUMERO_CAJA]
    );

    if (cajaData.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Caja no registrada o inactiva.',
      });
    }

    // Verificar si ya hay una apertura activa
    const [yaAbierta] = await pool.execute(
      'SELECT id FROM aperturas_cierres WHERE numero_caja = ? AND estado = "abierta" LIMIT 1',
      [NUMERO_CAJA]
    );

    if (yaAbierta.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Ya existe una caja abierta para este número.',
      });
    }

    // Insertar nueva apertura
    const [result] = await pool.execute(
      `INSERT INTO aperturas_cierres 
        (numero_caja, id_usuario_apertura, fecha_apertura, hora_apertura, monto_inicial, estado, observaciones)
       VALUES (?, ?, ?, ?, ?, 'abierta', ?)`,
      [
        NUMERO_CAJA,
        id_usuario_apertura,
        fecha,
        hora,
        parseFloat(monto_inicial),
        observaciones || null,
      ]
    );

    res.json({
      success: true,
      id: result.insertId,
      numero_caja: NUMERO_CAJA,
      fecha_apertura: fecha,
      hora_apertura: hora,
      monto_inicial: parseFloat(monto_inicial),
      estado: 'abierta',
      observaciones: observaciones || null,
    });
  } catch (err) {
    console.error('Error al abrir caja:', err);
    res.status(500).json({
      success: false,
      error: 'No se pudo abrir la caja.',
    });
  }
};

exports.listarCajaAbierta = async (req, res) => {
  const { numero_caja } = req.query;

  if (!numero_caja) {
    return res.status(400).json({
      success: false,
      message: 'Falta el número de caja',
    });
  }

  try {
    const [result] = await pool.execute(
      `SELECT 
         ac.id AS id_aperturas_cierres,
         ac.numero_caja,
         u.username AS nombre_usuario,
         ac.fecha_apertura,
         ac.hora_apertura,
         ac.estado
       FROM aperturas_cierres ac
       INNER JOIN users u ON ac.id_usuario_apertura = u.id
       WHERE ac.numero_caja = ? AND ac.estado = 'abierta'
       ORDER BY ac.id DESC
       LIMIT 1`,
      [numero_caja]
    );

    if (result.length === 0) {
      return res.json({
        success: false,
        message: 'No hay caja abierta para este número',
      });
    }

    return res.json({
      success: true,
      caja: result[0],
    });
  } catch (error) {
    console.error('Error al obtener la caja abierta:', error);
    return res.status(500).json({
      success: false,
      message: 'Error interno del servidor',
    });
  }
};

exports.cargarCajaAbiertaPorUsuario = async (req, res) => {
  const id_usuario = req.query.id_usuario;

  if (!id_usuario || isNaN(id_usuario)) {
    return res.status(400).json({ success: false, error: 'ID de usuario inválido.' });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT 
         ac.id AS id_aperturas_cierres,
         ac.numero_caja,
         c.nombre AS nombre_caja,
         u.username AS nombre_usuario,
         ac.fecha_apertura,
         ac.hora_apertura,
         ac.monto_inicial,
         ac.estado,
         ac.total_efectivo,
         ac.total_tarjeta,
         ac.total_general,
         ac.observaciones
       FROM aperturas_cierres ac
       INNER JOIN cajas c ON c.numero_caja = ac.numero_caja
       INNER JOIN users u ON u.id = ac.id_usuario_apertura
       WHERE ac.id_usuario_apertura = ? AND ac.estado = 'abierta'
       ORDER BY ac.fecha_apertura DESC, ac.hora_apertura DESC
       LIMIT 1`,
      [id_usuario]
    );

    if (rows.length === 0) {
      return res.json({ success: false, mensaje: 'No hay caja abierta asociada a este usuario.' });
    }

    res.json({ success: true, caja: rows[0] });

  } catch (err) {
    console.error('Error al cargar caja abierta:', err);
    res.status(500).json({ success: false, error: 'Error al obtener la caja abierta.' });
  }
};

exports.listarMovimientosPorUsuario = async (req, res) => {
  const id_usuario = req.query.id_usuario;

  if (!id_usuario || isNaN(id_usuario)) {
    return res.status(400).json({ success: false, error: 'ID de usuario inválido.' });
  }

  try {
    const [rows] = await pool.execute(
      `SELECT 
         m.id,
         m.fecha,
         m.hora,
         m.monto,
         m.medio_pago,                        
         s.nombre AS nombre_servicio
       FROM movimientos m
       INNER JOIN servicios s ON s.id = m.id_servicio
       WHERE m.id_usuario = ?
       ORDER BY m.fecha DESC, m.hora DESC`,
      [id_usuario]
    );

    res.json({ success: true, movimientos: rows });
  } catch (err) {
    console.error('Error al obtener movimientos:', err);
    res.status(500).json({ success: false, error: 'Error al listar movimientos.' });
  }
};

exports.listarMovimientosPorCaja = async (req, res) => {
  const numero_caja = req.query.numero_caja;

  if (!numero_caja || isNaN(numero_caja)) {
    return res.status(400).json({ success: false, error: 'Número de caja inválido.' });
  }

  try {
    // Verificar si hay una caja abierta para ese número
    const [cajaAbierta] = await pool.execute(
      `SELECT id 
       FROM aperturas_cierres 
       WHERE numero_caja = ? AND estado = 'abierta' 
       ORDER BY id DESC LIMIT 1`,
      [numero_caja]
    );

    if (cajaAbierta.length === 0) {
      return res.json({ success: false, mensaje: 'No hay caja abierta para este número.' });
    }

    const id_aperturas_cierres = cajaAbierta[0].id;

    // Obtener movimientos asociados a la sesión abierta
    const [movimientos] = await pool.execute(
      `SELECT 
         m.id,
         m.codigo,
         m.fecha,
         m.hora,
         m.monto,
         m.medio_pago,
         s.nombre AS nombre_servicio,
         s.tipo AS tipo_servicio,
         u.username AS nombre_usuario
       FROM movimientos m
       INNER JOIN servicios s ON s.id = m.id_servicio
       INNER JOIN users u ON u.id = m.id_usuario
       WHERE m.id_aperturas_cierres = ?
       ORDER BY m.fecha DESC, m.hora DESC`,
      [id_aperturas_cierres]
    );

    res.json({ success: true, movimientos });
  } catch (err) {
    console.error('Error al listar movimientos por caja:', err);
    res.status(500).json({ success: false, error: 'Error interno al listar movimientos.' });
  }
};

exports.registrarMovimiento = async (req, res) => {
  try {
    const { codigo, fecha, hora, tipo, valor, metodoPago, id_usuario } = req.body;
    const numero_caja = parseInt(process.env.NUMERO_CAJA); // Se usa número_caja directamente

    // Validaciones básicas
    if (!codigo || !fecha || !hora || !tipo || !valor || !metodoPago || !id_usuario) {
      return res.status(400).json({ success: false, message: 'Faltan datos requeridos' });
    }

    if (isNaN(valor) || valor <= 0) {
      return res.status(400).json({ success: false, message: 'Valor debe ser un número mayor a 0' });
    }

    if (isNaN(id_usuario)) {
      return res.status(400).json({ success: false, message: 'ID de usuario inválido' });
    }

    // Obtener ID del servicio a partir del tipo (BAÑO o DUCHA)
    const [servicioData] = await pool.execute(
      'SELECT id FROM servicios WHERE tipo = ? AND estado = "activo" LIMIT 1',
      [tipo]
    );

    if (servicioData.length === 0) {
      return res.status(400).json({ success: false, message: 'Tipo de servicio no válido o inactivo' });
    }

    const id_servicio = servicioData[0].id;

    // Obtener ID de la sesión de caja abierta
    const [apertura] = await pool.execute(
      'SELECT id FROM aperturas_cierres WHERE numero_caja = ? AND estado = "abierta" ORDER BY id DESC LIMIT 1',
      [numero_caja]
    );

    if (apertura.length === 0) {
      return res.status(400).json({ success: false, message: 'No hay caja abierta' });
    }

    const id_aperturas_cierres = apertura[0].id;

    // Insertar movimiento
    const [result] = await pool.execute(
      `INSERT INTO movimientos 
       (codigo, fecha, hora, id_servicio, monto, medio_pago, numero_caja, id_usuario, id_aperturas_cierres)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [codigo, fecha, hora, id_servicio, valor, metodoPago, numero_caja, id_usuario, id_aperturas_cierres]
    );

    res.json({ success: true, message: 'Movimiento registrado', insertId: result.insertId });

  } catch (error) {
    console.error('Error al registrar movimiento:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

exports.cerrarCaja = async (req, res) => {
  const { id_aperturas_cierres, id_usuario_cierre, observaciones, nombre_cajero } = req.body;

  if (!id_aperturas_cierres || !id_usuario_cierre) {
    return res.status(400).json({
      success: false,
      error: 'Datos obligatorios faltantes.',
    });
  }

  try {
    // Verificar que la sesión exista y esté abierta
    const [sesiones] = await pool.execute(
      `SELECT estado FROM aperturas_cierres WHERE id = ?`,
      [id_aperturas_cierres]
    );

    if (sesiones.length === 0) {
      return res.status(404).json({ success: false, error: 'Sesión no encontrada.' });
    }

    if (sesiones[0].estado !== 'abierta') {
      return res.status(400).json({ success: false, error: 'La sesión ya está cerrada.' });
    }

    // Obtener totales desde la tabla movimientos CONSIDERANDO RETIROS
    const [[totales]] = await pool.execute(
      `SELECT 
         SUM(CASE WHEN medio_pago = 'EFECTIVO' AND id_servicio != 999 THEN monto ELSE 0 END) AS total_efectivo,
         SUM(CASE WHEN medio_pago = 'TARJETA' THEN monto ELSE 0 END) AS total_tarjeta,
         SUM(CASE WHEN id_servicio = 999 THEN monto ELSE 0 END) AS total_retiros
       FROM movimientos
       WHERE id_aperturas_cierres = ?`,
      [id_aperturas_cierres]
    );

    const total_efectivo = totales.total_efectivo || 0;
    const total_tarjeta = totales.total_tarjeta || 0;
    const total_retiros = Math.abs(totales.total_retiros) || 0; // Convertir a positivo

    const now = new Date();
    const fecha_cierre = now.toISOString().split('T')[0];
    const hora_cierre = now.toTimeString().split(':').slice(0, 2).join(':');

    // Obtener monto inicial y datos de la caja
    const [[aperturaInfo]] = await pool.execute(
      `SELECT a.monto_inicial, a.numero_caja, c.nombre as nombre_caja 
      FROM aperturas_cierres a
      LEFT JOIN cajas c ON a.numero_caja = c.numero_caja
      WHERE a.id = ?`,
      [id_aperturas_cierres]
    );

    const monto_inicial = aperturaInfo.monto_inicial || 0;
    const numero_caja = aperturaInfo.numero_caja;
    const nombre_caja = aperturaInfo.nombre_caja || `Caja ${numero_caja}`;

    // Obtener nombre del usuario que cierra (admin/supervisor)
    const [[usuarioInfo]] = await pool.execute(
      `SELECT username FROM users WHERE id = ?`,
      [id_usuario_cierre]
    );

    const nombre_usuario_cierre = usuarioInfo.username;

    // Calcular balance final (monto inicial + efectivo - retiros)
    const balance_final = Number(monto_inicial) + Number(total_efectivo) - Number(total_retiros);

    // Actualizar la sesión con los nuevos campos
    await pool.execute(
      `UPDATE aperturas_cierres
       SET estado = 'cerrada',
           fecha_cierre = ?,
           hora_cierre = ?,
           id_usuario_cierre = ?,
           total_efectivo = ?,
           total_tarjeta = ?,
           total_retiros = ?,
           balance_final = ?,
           observaciones = ?
       WHERE id = ?`,
      [
        fecha_cierre,
        hora_cierre,
        id_usuario_cierre,
        total_efectivo,
        total_tarjeta,
        total_retiros,
        balance_final,
        observaciones || null,
        id_aperturas_cierres,
      ]
    );

    // Imprimir ticket de cierre con la información completa
    await imprimirCierreCaja({
      monto_inicial,
      total_efectivo,
      total_tarjeta,
      total_retiros,
      balance_final,
      fecha_cierre,
      hora_cierre,
      numero_caja,
      nombre_caja,
      nombre_usuario: nombre_usuario_cierre,
      nombre_cajero: nombre_cajero || 'Cajero'
    });

    res.json({
      success: true,
      mensaje: 'Caja cerrada correctamente.',
      data: {
        monto_inicial,
        total_efectivo,
        total_tarjeta,
        total_retiros,
        balance_final,
        fecha_cierre,
        hora_cierre,
        nombre_cajero: nombre_cajero || 'Cajero'
      },
    });
  } catch (err) {
    console.error('Error al cerrar la caja:', err);
    res.status(500).json({
      success: false,
      error: 'Error interno al cerrar la caja.',
    });
  }
};

exports.listarCajasDelDia = async (req, res) => {
  try {
    const [registros] = await pool.execute(
      `SELECT 
         ac.id,
         ac.fecha_apertura,
         ac.hora_apertura,
         ac.monto_inicial,
         ac.total_efectivo,
         ac.total_tarjeta,
         ac.observaciones,
         u.username,
         c.nombre AS nombre_caja
       FROM aperturas_cierres ac
       INNER JOIN users u ON u.id = ac.id_usuario_apertura
       INNER JOIN cajas c ON c.numero_caja = ac.numero_caja
       WHERE ac.fecha_apertura = CURDATE()
         AND ac.fue_arqueada = FALSE`
    );

    res.json({
      success: true,
      detalles: registros
    });
  } catch (err) {
    console.error('Error al listar cajas del día:', err);
    res.status(500).json({ success: false, error: 'Error interno.' });
  }
};

exports.registrarRetiro = async (req, res) => {
  try {
    const { monto, id_usuario, motivo, nombre_cajero } = req.body;
    const numero_caja = parseInt(process.env.NUMERO_CAJA);

    // Validaciones
    if (!monto || isNaN(monto) || parseFloat(monto) <= 0) {
      return res.status(400).json({ success: false, message: 'Monto inválido' });
    }
    
    if (!id_usuario || isNaN(id_usuario)) {
      return res.status(400).json({ success: false, message: 'ID de usuario inválido' });
    }

    // Obtener ID de la sesión de caja abierta
    const [apertura] = await pool.execute(
      'SELECT id FROM aperturas_cierres WHERE numero_caja = ? AND estado = "abierta" ORDER BY id DESC LIMIT 1',
      [numero_caja]
    );

    if (apertura.length === 0) {
      return res.status(400).json({ success: false, message: 'No hay caja abierta' });
    }

    const id_aperturas_cierres = apertura[0].id;

    // Obtener información del usuario que AUTORIZA el retiro (admin/recaudador)
    const [usuario] = await pool.execute(
      'SELECT username FROM users WHERE id = ?',
      [id_usuario]
    );

    if (usuario.length === 0) {
      return res.status(400).json({ success: false, message: 'Usuario no encontrado' });
    }

    const nombre_autorizador = usuario[0].username;

    // Obtener el nombre de la caja desde la tabla cajas
    const [cajaInfo] = await pool.execute(
      'SELECT nombre FROM cajas WHERE numero_caja = ?',
      [numero_caja]
    );

    const nombre_caja = cajaInfo.length > 0 ? cajaInfo[0].nombre : `Caja ${numero_caja}`;

    // Usar ID fijo para retiros (debe existir en la tabla servicios)
    const id_servicio = 999; // ID del servicio de retiros

    // Generar código único para el retiro
    const codigo = 'RET-' + Date.now();
    const fecha = new Date().toISOString().split('T')[0];
    const hora = new Date().toTimeString().split(' ')[0];

    // Insertar movimiento de retiro
    const [result] = await pool.execute(
      `INSERT INTO movimientos 
       (codigo, fecha, hora, id_servicio, monto, medio_pago, numero_caja, id_usuario, id_aperturas_cierres)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        codigo,
        fecha,
        hora,
        id_servicio, // ID válido que existe en servicios
        -Math.abs(monto), // Valor NEGATIVO
        'Retiro de efectivo',
        numero_caja,
        id_usuario,
        id_aperturas_cierres
      ]
    );

    // Preparar datos para impresión (en lugar de imprimir directamente)
    const datosImpresion = {
      codigo,
      fecha,
      hora,
      monto: Math.abs(monto), // Mostrar valor positivo en el ticket
      nombre_usuario: nombre_autorizador,  // Usuario que autoriza (admin/recaudador)
      nombre_caja,
      motivo: motivo || 'Retiro de efectivo',
      nombre_cajero: nombre_cajero || 'Cajero'  // Nombre del cajero que realiza la operación
    };

    res.json({ 
      success: true, 
      message: 'Retiro registrado exitosamente',
      insertId: result.insertId,
      datosImpresion: datosImpresion, // Devolvemos los datos para impresión
      retiro: {
        id: result.insertId,
        codigo,
        fecha,
        hora,
        monto: -Math.abs(monto),
        medio_pago: 'Retiro de efectivo',
        id_servicio: id_servicio
      }
    });

  } catch (error) {
    console.error('Error al registrar retiro:', error);
    res.status(500).json({ success: false, message: 'Error interno del servidor' });
  }
};

// Nueva función para imprimir comprobante de retiro (se llamará desde el frontend)
const { PDFDocument, StandardFonts } = require("pdf-lib");
const imprimirPDF = require('../services/printService');

exports.imprimirComprobanteRetiro = async (req, res) => {
  try {
    const { codigo, fecha, hora, monto, nombre_usuario, nombre_caja, motivo, nombre_cajero } = req.body;
    
    // Validaciones básicas
    if (!codigo || !monto) {
      return res.status(400).json({ 
        success: false, 
        message: 'Código y monto son requeridos' 
      });
    }

    // 1. Generar el PDF
    const pdfDoc = await PDFDocument.create();

    // --- Datos base ---
    const fechaObj = new Date(fecha);
    const dia = String(fechaObj.getDate()).padStart(2, "0");
    const mes = String(fechaObj.getMonth() + 1).padStart(2, "0");
    const anio = String(fechaObj.getFullYear());
    const fechaFormateada = `${dia}-${mes}-${anio}`;

    // --- Secciones simples ---
    const detalle = [
      "COMPROBANTE DE RETIRO",
      motivo ? `MOTIVO: ${motivo}` : "DE EFECTIVO",
      "---------------------------------------------------",
      `Codigo: ${codigo}`,
      `Fecha:  ${fechaFormateada}`,
      `Hora:   ${hora}`,
      `Caja:   ${nombre_caja}`,
      `Cajero: ${nombre_cajero}`,
      `Autorizado por: ${nombre_usuario}`,
      "---------------------------------------------------",
      "MONTO RETIRADO:",
      `$${parseFloat(monto).toLocaleString('es-CL')}`,
      "---------------------------------------------------",
    ].filter(Boolean);

    const footer = [
      " ",
      "FIRMA AUTORIZADA:",
      " ",
      " ",
      "_________________________",
      " ",
      " ",
      "."
    ];

    // --- Cálculo de altura ---
    const lineHeight = 15;
    const topMargin = 30;
    const bottomMargin = 30;
    const espacioFirma = 40;

    let altura = topMargin + 
                (detalle.length * lineHeight) + 
                espacioFirma + 
                (footer.length * lineHeight) + 
                bottomMargin;

    // --- Crear página ---
    const page = pdfDoc.addPage([210, altura]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Posición inicial
    let y = altura - topMargin;

    // --- Detalles ---
    detalle.forEach((line) => {
      const isTitle = line === "COMPROBANTE DE RETIRO" || line.startsWith("MOTIVO:");
      const isMonto = line.includes("MONTO RETIRADO") || line.includes("$");
      const isSeparator = line.includes("---");
      
      const currentFont = isTitle || isMonto ? boldFont : font;
      const currentSize = isMonto ? 13 : isTitle ? 13 : 12;
      
      if (isSeparator) {
        page.drawText(line, { x: 15, y, size: 12, font });
      } else {
        const textWidth = currentFont.widthOfTextAtSize(line, currentSize);
        const centeredX = (210 - textWidth) / 2;
        page.drawText(line, { x: centeredX, y, size: currentSize, font: currentFont });
      }
      y -= lineHeight;
    });

    // Espacio para firma
    y -= 20;

    // --- Footer ---
    footer.forEach((line) => {
      const isFirma = line === "FIRMA AUTORIZADA:";
      const currentFont = isFirma ? boldFont : font;
      const currentSize = isFirma ? 13 : 11;
      
      const textWidth = currentFont.widthOfTextAtSize(line, currentSize);
      const centeredX = (210 - textWidth) / 2;
      page.drawText(line, { x: centeredX, y, size: currentSize, font: currentFont });
      y -= lineHeight;
    });

    // 2. Obtener el PDF como buffer y convertirlo a base64
    const pdfBytes = await pdfDoc.save();

    // 3. Usar el nuevo servicio simplificado para imprimir
    await imprimirPDF({
      pdfData: Buffer.from(pdfBytes), // 👈 aquí va directo como Buffer
      printer: "POS58",
      filename: `retiro-${codigo}-${Date.now()}.pdf`
    });
    
    res.json({ success: true, message: 'Comprobante impreso correctamente' });
  } catch (error) {
    console.error('Error al imprimir comprobante:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error al imprimir comprobante',
      error: error.message 
    });
  }
};