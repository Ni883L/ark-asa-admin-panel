const crypto = require('crypto');
const defaults = require('../config/defaults');
const store = require('./store');
const logger = require('./logger');
const { verifyPassword, hashPassword } = require('../util/passwords');
const { requireString } = require('../util/validators');

function nowMs() { return Date.now(); }

function cleanAttempts(bucket) {
  const cutoff = nowMs() - defaults.security.loginWindowMinutes * 60 * 1000;
  return bucket.filter(ts => ts >= cutoff);
}

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').toString().split(',')[0].trim();
}

function ensureNotBlocked(ip) {
  const data = store.getUsers();
  const blockUntil = data.blockedIps[ip];
  if (blockUntil && blockUntil > nowMs()) {
    throw new Error('IP temporär gesperrt. Bitte später erneut versuchen.');
  }
  if (blockUntil && blockUntil <= nowMs()) {
    delete data.blockedIps[ip];
    store.saveUsers(data);
  }
}

function recordFailedAttempt(ip) {
  const data = store.getUsers();
  const attempts = cleanAttempts(data.loginAttempts[ip] || []);
  attempts.push(nowMs());
  data.loginAttempts[ip] = attempts;
  if (attempts.length >= defaults.security.loginMaxAttempts) {
    data.blockedIps[ip] = nowMs() + defaults.security.loginBlockMinutes * 60 * 1000;
    logger.warn('IP blocked after failed logins', { ip });
  }
  store.saveUsers(data);
}

function clearFailedAttempts(ip) {
  const data = store.getUsers();
  delete data.loginAttempts[ip];
  store.saveUsers(data);
}

function login(req, username, password) {
  const ip = getClientIp(req);
  ensureNotBlocked(ip);
  const normalizedUser = requireString(username, 'Benutzername');
  const normalizedPass = requireString(password, 'Passwort');
  const data = store.getUsers();
  const user = data.users.find(item => item.username.toLowerCase() === normalizedUser.toLowerCase());
  if (!user || !verifyPassword(normalizedPass, user.passwordHash)) {
    recordFailedAttempt(ip);
    logger.warn('Failed login', { username: normalizedUser, ip });
    throw new Error('Ungültige Zugangsdaten.');
  }
  clearFailedAttempts(ip);
  req.session.user = { username: user.username, role: user.role };
  req.session.csrfToken = crypto.randomBytes(24).toString('hex');
  logger.audit(user.username, 'login', { ip });
  return { username: user.username, role: user.role, mustChangePassword: !!user.mustChangePassword, csrfToken: req.session.csrfToken };
}

function logout(req) {
  const actor = req.session?.user?.username || 'unknown';
  req.session.destroy(() => {});
  logger.audit(actor, 'logout');
}

function requireAuth(req) {
  if (!req.session?.user) throw new Error('Nicht angemeldet.');
  return req.session.user;
}

function requireRole(req, allowedRoles = ['admin']) {
  const user = requireAuth(req);
  if (!allowedRoles.includes(user.role)) throw new Error('Keine Berechtigung.');
  return user;
}

function changePassword(req, currentPassword, newPassword) {
  const sessionUser = requireAuth(req);
  const data = store.getUsers();
  const user = data.users.find(item => item.username === sessionUser.username);
  if (!user || !verifyPassword(currentPassword, user.passwordHash)) {
    throw new Error('Aktuelles Passwort ist falsch.');
  }
  user.passwordHash = hashPassword(requireString(newPassword, 'Neues Passwort'));
  user.mustChangePassword = false;
  store.saveUsers(data);
  logger.audit(sessionUser.username, 'change-password');
}

module.exports = { login, logout, requireAuth, requireRole, changePassword, getClientIp };
