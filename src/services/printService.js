const fs = require("fs");
const os = require("os");
const path = require("path");
const { print } = require("pdf-to-printer");

/**
 * Función universal para imprimir PDFs
 * @param {Object} config - Configuración de impresión
 * @param {string|Buffer} config.pdfData - PDF en base64, buffer o ruta de archivo
 * @param {string} [config.printer] - Nombre de la impresora (opcional)
 * @param {string} [config.filename] - Nombre del archivo (opcional)
 * @returns {Promise<Object>} - Resultado de la impresión
 */
async function imprimirPDF(config) {
  try {
    console.log("🟢 Iniciando proceso de impresión de PDF");
    
    // Validar configuración mínima
    if (!config || !config.pdfData) {
      throw new Error("Datos del PDF no proporcionados");
    }
    
    let filePath;

    // Manejar diferentes formatos de entrada
    if (typeof config.pdfData === 'string') {
      // Si es una ruta de archivo
      if (config.pdfData.endsWith('.pdf') && fs.existsSync(config.pdfData)) {
        filePath = config.pdfData;
        console.log(`📁 Usando archivo PDF existente: ${filePath}`);
      } 
      // Si es base64 con prefijo
      else if (config.pdfData.startsWith('data:application/pdf;base64,')) {
        const filename = config.filename || `documento-${Date.now()}.pdf`;
        filePath = path.join(os.tmpdir(), filename);
        const base64Data = config.pdfData.replace(/^data:application\/pdf;base64,/, "");
        fs.writeFileSync(filePath, base64Data, 'base64');
        console.log(`📁 PDF guardado temporalmente en: ${filePath}`);
      }
      // Si es base64 sin prefijo
      else if (config.pdfData.length > 100 && !config.pdfData.includes(' ')) {
        const filename = config.filename || `documento-${Date.now()}.pdf`;
        filePath = path.join(os.tmpdir(), filename);
        fs.writeFileSync(filePath, config.pdfData, 'base64');
        console.log(`📁 PDF guardado temporalmente en: ${filePath}`);
      }
      else {
        throw new Error("Formato de datos PDF no válido");
      }
    } 
    // Si es un Buffer
    else if (Buffer.isBuffer(config.pdfData)) {
      const filename = config.filename || `documento-${Date.now()}.pdf`;
      filePath = path.join(os.tmpdir(), filename);
      fs.writeFileSync(filePath, config.pdfData);
      console.log(`📁 PDF guardado temporalmente en: ${filePath}`);
    } 
    else {
      throw new Error("Formato de datos PDF no válido");
    }

    console.log(`🖨️ Enviando a impresora: ${config.printer || "(predeterminada)"}`);
    
    // Armar opciones para pdf-to-printer
    const options = {};
    if (config.printer) options.printer = config.printer;

    // Imprimir
    await print(filePath, options);
    
    // Limpiar archivo temporal si fue creado por nosotros
    if (filePath.startsWith(os.tmpdir())) {
      fs.unlink(filePath, (err) => {
        if (err) {
          console.warn("⚠️ No se pudo eliminar archivo temporal:", err.message);
        } else {
          console.log("✅ Archivo temporal eliminado");
        }
      });
    }
    
    console.log("✅ Impresión completada exitosamente");
    return { success: true, message: "PDF impreso correctamente" };
    
  } catch (error) {
    console.error("🛑 Error en imprimirPDF:", error.message);
    throw error;
  }
}

module.exports = imprimirPDF;
