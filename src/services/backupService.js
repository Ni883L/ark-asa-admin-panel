const fs = require('fs');
const path = require('path');
const defaults = require('../config/defaults');
const powershell = require('./powershell');
const logger = require('./logger');
const backupRetentionService = require('./backupRetentionService');

function parseValidationOutput(raw) {
  let parsed = {};
  try {
    parsed = JSON.parse(raw || '{}');
  } catch (_error) {
    parsed = {};
  }
  return {
    valid: !!parsed.valid,
    hasSavedArks: !!parsed.hasSavedArks,
    hasConfig: !!parsed.hasConfig,
    hasCluster: !!parsed.hasCluster,
    hasLog: !!parsed.hasLog
  };
}

function resolveBackupFile(name) {
  const normalized = path.basename(String(name || ''));
  if (!normalized || !normalized.toLowerCase().endsWith('.zip')) {
    throw new Error('Ungültiger Backup-Name.');
  }
  const file = path.join(defaults.paths.backupDir, normalized);
  if (!fs.existsSync(file)) throw new Error('Backup nicht gefunden.');
  return { name: normalized, file };
}

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
  backupRetentionService.applyRetention();
  logger.audit('system', 'backup-create', { type });
  return result;
}

async function validateBackup(name) {
  const resolved = resolveBackupFile(name);
  const { file } = resolved;
  const result = await powershell.run('backup-validate.ps1', [file]);
  const validation = parseValidationOutput(result.stdout);
  if (!validation.valid) throw new Error('Backup ist ungültig oder enthält keine unterstützten Daten.');
  return { name: resolved.name, file, validation };
}

async function restoreBackup(name, mode = 'full') {
  const resolved = resolveBackupFile(name);
  const { file } = resolved;
  if (!['full', 'save', 'config', 'cluster'].includes(mode)) {
    throw new Error('Ungültiger Restore-Modus.');
  }
  await validateBackup(resolved.name);
  const preRestore = await createBackup('pre-restore');
  const result = await powershell.run('backup-restore.ps1', [file, mode]);
  logger.audit('system', 'backup-restore', { name: resolved.name, mode, preRestore: preRestore.stdout || null });
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

module.exports = { listBackups, createBackup, restoreBackup, importBackup, validateBackup, parseValidationOutput, resolveBackupFile };
