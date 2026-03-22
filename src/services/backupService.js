const fs = require('fs');
const path = require('path');
const defaults = require('../config/defaults');
const powershell = require('./powershell');
const logger = require('./logger');
const backupRetentionService = require('./backupRetentionService');

function listBackups() {
  fs.mkdirSync(defaults.paths.backupDir, { recursive: true });
  return fs.readdirSync(defaults.paths.backupDir)
    .filter(name => name.toLowerCase().endsWith('.zip'))
    .map(name => {
      const file = path.join(defaults.paths.backupDir, name);
      const stat = fs.statSync(file);
      return { name, file, size: stat.size, modifiedAt: stat.mtime.toISOString() };
    })
    .sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
}

async function createBackup(type = 'manual') {
  const result = await powershell.run('backup-create.ps1', [type]);
  logger.audit('system', 'backup-create', { type });
  return result;
}

async function restoreBackup(name, mode = 'full') {
  const file = path.join(defaults.paths.backupDir, name);
  if (!fs.existsSync(file)) throw new Error('Backup nicht gefunden.');
  if (!['full', 'save', 'config', 'cluster'].includes(mode)) {
    throw new Error('Ungültiger Restore-Modus.');
  }
  const preRestore = await createBackup('pre-restore');
  const result = await powershell.run('backup-restore.ps1', [file, mode]);
  logger.audit('system', 'backup-restore', { name, mode, preRestore: preRestore.stdout || null });
  return { ...result, preRestore: preRestore.stdout || null };
}

function importBackup(tempFilePath, originalName) {
  fs.mkdirSync(defaults.paths.backupDir, { recursive: true });
  const safeName = `${Date.now()}-${path.basename(originalName || 'import.zip')}`;
  const destination = path.join(defaults.paths.backupDir, safeName);
  fs.copyFileSync(tempFilePath, destination);
  logger.audit('system', 'backup-import', { safeName });
  return { name: safeName, file: destination };
}

module.exports = { listBackups, createBackup, restoreBackup, importBackup };
ckup, importBackup };
