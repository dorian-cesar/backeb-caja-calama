const imprimirPDF = require('../services/printService');

/**
 * Controlador genérico para imprimir PDFs
 * Endpoint: POST /api/imprimir
 * 
 * Ejemplo de body esperado:
 * {
 *   "pdfData": "<base64|Buffer|ruta>",
 *   "printer": "Nombre exacto de impresora (opcional)",
 *   "filename": "documento.pdf (opcional)"
 * }
 */

// Controlador genérico que imprime lo que recibe
exports.imprimir = async (req, res) => {
  try {
    const { pdfData, printer, filename } = req.body;

    if (!pdfData) {
      return res.status(400).json({
        success: false,
        message: 'No se proporcionaron datos de PDF'
      });
    }

    await imprimirPDF({
      pdfData,   // puede ser Buffer, base64 o ruta
      printer,   // opcional, si no se pasa usa la predeterminada
      filename   // opcional
    });

    res.json({ success: true, message: 'PDF enviado a la impresora correctamente' });
  } catch (error) {
    console.error('Error en /api/imprimir:', error);
    res.status(500).json({
      success: false,
      message: 'Error al imprimir',
      error: error.message
    });
  }
};

