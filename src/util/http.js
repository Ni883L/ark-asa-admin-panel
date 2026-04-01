function sendError(res, error, fallbackStatus = 500) {
  const status = Number(error?.status || fallbackStatus || 500);
  const payload = {
    error: error?.expose === false ? 'Interner Serverfehler.' : (error?.message || 'Interner Serverfehler.'),
    code: error?.code || 'INTERNAL_ERROR'
  };
  return res.status(status).json(payload);
}

module.exports = { sendError };
