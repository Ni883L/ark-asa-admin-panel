const defaults = require('../config/defaults');
const { appendLine } = require('../util/fsx');

function log(level, message, meta = {}) {
  const entry = { ts: new Date().toISOString(), level, message, meta };
  appendLine(defaults.files.appLog, JSON.stringify(entry));
}

function audit(actor, action, meta = {}) {
  const entry = { ts: new Date().toISOString(), actor, action, meta };
  appendLine(defaults.files.auditLog, JSON.stringify(entry));
}

module.exports = {
  info: (message, meta) => log('info', message, meta),
  warn: (message, meta) => log('warn', message, meta),
  error: (message, meta) => log('error', message, meta),
  audit
};
