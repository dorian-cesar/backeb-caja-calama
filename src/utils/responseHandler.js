const responseHandler = {
  success: (res, message, data = {}, status = 200) => {
    res.status(status).json({
      success: true,
      message,
      data
    });
  },

  error: (res, message, status = 500, code = 'INTERNAL_ERROR', meta = {}) => {
    const response = {
      success: false,
      error: message,
      code
    };

    // Si estamos en entorno de desarrollo y hay detalles adicionales
    if (process.env.NODE_ENV === 'development' && Object.keys(meta).length > 0) {
      response.meta = meta;
    }

    res.status(status).json(response);
  }
};

module.exports = responseHandler;
