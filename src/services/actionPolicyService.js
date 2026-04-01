const authService = require('./authService');
const { ValidationError, PermissionError } = require('../util/errors');

function requireConfirmation(action, payload = {}) {
  const critical = new Set(['reboot-host', 'asa-update', 'panel-update', 'restore-backup']);
  if (!critical.has(action)) {
    return { ok: true, required: false };
  }

  if (payload.confirm !== true) {
    throw new ValidationError(`Bestätigung für kritische Aktion fehlt: ${action}`, 'CONFIRMATION_REQUIRED');
  }

  return { ok: true, required: true };
}

function requireRecentAuth(req, payload = {}, options = {}) {
  const maxAgeMs = Number(options.maxAgeMs || 5 * 60 * 1000);
  const sessionUser = req.session?.user;
  if (!sessionUser) {
    throw new PermissionError('Nicht angemeldet.', 'AUTH_REQUIRED');
  }

  const requirePassword = options.requirePassword === true || payload.requirePassword === true;
  if (!requirePassword) {
    return { ok: true, required: false, maxAgeMs };
  }

  const currentPassword = String(payload.currentPassword || '');
  if (!currentPassword.trim()) {
    throw new ValidationError('Passwortbestätigung erforderlich.', 'PASSWORD_CONFIRMATION_REQUIRED');
  }

  const verified = authService.verifyCurrentUserPassword(req, currentPassword);
  if (!verified) {
    throw new PermissionError('Passwortbestätigung fehlgeschlagen.', 'PASSWORD_CONFIRMATION_FAILED');
  }

  req.session.lastSensitiveAuthAt = Date.now();
  return { ok: true, required: true, maxAgeMs };
}

module.exports = { requireConfirmation, requireRecentAuth };
