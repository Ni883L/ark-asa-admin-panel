const defaults = require('../config/defaults');

function getRuntimeWarnings() {
  const warnings = [];

  if (!defaults.app.sessionSecret || defaults.app.sessionSecret === 'change-me' || defaults.app.sessionSecret === 'change-this-session-secret') {
    warnings.push({ code: 'DEFAULT_SESSION_SECRET', level: 'warn', message: 'SESSION_SECRET ist noch auf einem unsicheren Standardwert.' });
  }

  const host = String(defaults.app.host || '').trim();
  const localHosts = new Set(['127.0.0.1', 'localhost', '::1']);
  const remoteBinding = host && !localHosts.has(host) && host !== '0.0.0.0';

  if (defaults.security.enableRemoteAccess && !defaults.app.httpsEnabled) {
    warnings.push({ code: 'REMOTE_WITHOUT_HTTPS', level: 'warn', message: 'Remote-Zugriff ist aktiv, aber HTTPS ist deaktiviert.' });
  }

  if (defaults.security.enableRemoteAccess && (remoteBinding || host === '0.0.0.0')) {
    warnings.push({ code: 'REMOTE_BINDING_ACTIVE', level: 'warn', message: `Anwendung lauscht nicht nur lokal auf HOST=${host}.` });
  }

  return warnings;
}

module.exports = { getRuntimeWarnings };
