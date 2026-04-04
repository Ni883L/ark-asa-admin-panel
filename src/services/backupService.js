const fs = require('fs');
const path = require('path');
const defaults = require('../config/defaults');
const powershell = require('./powershell');
const logger = require('./logger');
const backupRetentionService = require('./backupRetentionService');
const { ValidationError } = require('../util/errors');

function normalizeBackupName(name) {
  const normalized = String(name || '').trim();
  if (!normalized) throw new ValidationError('Backupname fehlt.', 'BACKUP_NAME_REQUIRED');
  if (path.basename(normalized) !== normalized) throw new ValidationError('Ungültiger Backupname.', 'BACKUP_NAME_INVALID');
  if (!normalized.toLowerCase().endsWith('.zip')) throw new ValidationError('Backup muss eine ZIP-Datei sein.', 'BACKUP_NAME_NOT_ZIP');
  return normalized;
}

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
  const normalized = normalizeBackupName(name);
  const file = path.join(defaults.paths.backupDir, normalized);
  if (!fs.existsSync(file)) throw new ValidationError('Backup nicht gefunden.', 'BACKUP_NOT_FOUND');
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
  const normalizedType = String(type || 'manual');
  const result = await powershell.run('backup-create.ps1', [normalizedType]);
  logger.audit('system', 'backup-create', { type: normalizedType });
  if (backupRetentionService?.applyRetention) {
    backupRetentionService.applyRetention();
  }
  if (backupRetentionService?.enforceRetention) {
    backupRetentionService.enforceRetention();
  }
  return result;
}

async function validateBackup(name) {
  const resolved = resolveBackupFile(name);
  const result = await powershell.run('backup-validate.ps1', [resolved.file]);
  const validation = parseValidationOutput(result.stdout);
  if (!validation.valid) throw new ValidationError('Backup ist ungültig oder enthält keine unterstützten Daten.', 'BACKUP_INVALID');
  return { name: resolved.name, file: resolved.file, validation };
}

async function restoreBackup(name, mode = 'full') {
  const resolved = resolveBackupFile(name);
  if (!['full', 'save', 'config', 'cluster'].includes(mode)) {
    throw new ValidationError('Ungültiger Restore-Modus.', 'BACKUP_MODE_INVALID');
  }
  await validateBackup(resolved.name);
  const preRestore = await createBackup('pre-restore');
  const result = await powershell.run('backup-restore.ps1', [resolved.file, mode]);
  logger.audit('system', 'backup-restore', { name: resolved.name, mode, preRestore: preRestore.stdout || null });
  return { ...result, preRestore: preRestore.stdout || null };
}

function importBackup(tempFilePath, originalName) {
  fs.mkdirSync(defaults.paths.backupDir, { recursive: true });
  const baseName = path.basename(String(originalName || 'import.zip'));
  if (!baseName.toLowerCase().endsWith('.zip')) {
    throw new ValidationError('Nur ZIP-Backups können importiert werden.', 'BACKUP_IMPORT_NOT_ZIP');
  }
  const safeName = `${Date.now()}-${baseName}`;
  const destination = path.join(defaults.paths.backupDir, safeName);
  fs.copyFileSync(tempFilePath, destination);
  logger.audit('system', 'backup-import', { safeName });
  return { name: safeName, file: destination };
}

function exportSavegameBundle() {
  fs.mkdirSync(defaults.paths.tempDir, { recursive: true });
  fs.mkdirSync(defaults.paths.backupDir, { recursive: true });
  const exportName = `savegame-export-${Date.now()}.zip`;
  const exportFile = path.join(defaults.paths.backupDir, exportName);
  const sourcePath = defaults.asa.savedArksPath;
  if (!sourcePath || !fs.existsSync(sourcePath)) {
    throw new ValidationError('SavedArks-Pfad nicht gefunden.', 'SAVEGAME_SOURCE_MISSING');
  }
  return { exportName, exportFile, sourcePath };
}

module.exports = {
  listBackups,
  createBackup,
  restoreBackup,
  importBackup,
  exportSavegameBundle,
  validateBackup,
  parseValidationOutput,
  resolveBackupFile,
  normalizeBackupName
};
