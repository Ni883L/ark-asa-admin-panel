const fs = require('fs');
const path = require('path');
const defaults = require('../config/defaults');

function listPanelBackups() {
  const dir = path.join(process.cwd(), 'ark-asa-admin', 'runtime', 'backups', 'panel');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(name => name.endsWith('.zip')).sort().reverse();
}

module.exports = { listPanelBackups };
