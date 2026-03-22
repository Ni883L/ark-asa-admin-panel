const fs = require('fs');
const path = require('path');
const defaults = require('../config/defaults');
const store = require('./store');
const logger = require('./logger');

function applyRetention() {
  fs.mkdirSync(defaults.paths.backupDir, { recursive: true });
  const retention = Number(store.getSettings().backupRetention || 14);
  const files = fs.readdirSync(defaults.paths.backupDir)
    .filter(name => name.toLowerCase().endsWith('.zip'))
    .map(name => ({ name, file: path.join(defaults.paths.backupDir, name), stat: fs.statSync(path.join(defaults.paths.backupDir, name)) }))
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

  const expired = files.slice(retention);
  for (const item of expired) {
    fs.unlinkSync(item.file);
  }
  if (expired.length) {
    logger.audit('system', 'backup-retention-prune', { removed: expired.map(item => item.name) });
  }
  return { kept: files.length - expired.length, removed: expired.length };
}

module.exports = { applyRetention };
