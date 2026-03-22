const defaults = require('../config/defaults');
const authService = require('../services/authService');

function headers(req, res, next) {
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'");
  next();
}

function ipFilter(req, res, next) {
  if (defaults.security.enableRemoteAccess) return next();
  const ip = authService.getClientIp(req);
  const local = ['127.0.0.1', '::1', '::ffff:127.0.0.1'];
  if (local.includes(ip)) return next();
  return res.status(403).json({ error: 'Remote-Zugriff ist deaktiviert.' });
}

function csrf(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (!req.session?.user) return next();
  const token = req.headers[defaults.app.csrfHeaderName];
  if (!token || token !== req.session.csrfToken) {
    return res.status(403).json({ error: 'CSRF-Prüfung fehlgeschlagen.' });
  }
  next();
}

module.exports = { headers, ipFilter, csrf };
