const fs = require('fs');
const defaults = require('../config/defaults');

function listAuditLines(limit = 200) {
  if (!fs.existsSync(defaults.files.auditLog)) return [];
  return fs.readFileSync(defaults.files.auditLog, 'utf8').trim().split(/\r?\n/).filter(Boolean).slice(-limit).reverse();
}

module.exports = { listAuditLines };
