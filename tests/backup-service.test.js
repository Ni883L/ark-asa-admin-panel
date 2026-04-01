const test = require('node:test');
const assert = require('node:assert/strict');

test('backupService exports expected API', () => {
  const backupService = require('../src/services/backupService');
  assert.equal(typeof backupService.listBackups, 'function');
  assert.equal(typeof backupService.createBackup, 'function');
  assert.equal(typeof backupService.restoreBackup, 'function');
  assert.equal(typeof backupService.importBackup, 'function');
  assert.equal(typeof backupService.validateBackup, 'function');
  assert.equal(typeof backupService.parseValidationOutput, 'function');
  assert.equal(typeof backupService.resolveBackupFile, 'function');
});

test('parseValidationOutput normalizes flags', () => {
  const backupService = require('../src/services/backupService');
  const result = backupService.parseValidationOutput('{"valid":1,"hasSavedArks":true}');
  assert.equal(result.valid, true);
  assert.equal(result.hasSavedArks, true);
  assert.equal(result.hasConfig, false);
  assert.equal(result.hasCluster, false);
  assert.equal(result.hasLog, false);
});

test('parseValidationOutput handles invalid json', () => {
  const backupService = require('../src/services/backupService');
  const result = backupService.parseValidationOutput('{invalid');
  assert.equal(result.valid, false);
  assert.equal(result.hasSavedArks, false);
  assert.equal(result.hasConfig, false);
  assert.equal(result.hasCluster, false);
  assert.equal(result.hasLog, false);
});

test('resolveBackupFile rejects unsafe names', () => {
  const backupService = require('../src/services/backupService');
  assert.throws(() => backupService.resolveBackupFile('../evil.zip'), /Backup nicht gefunden|Ungültiger Backupname|Ungültiger Backup-Name/);
  assert.throws(() => backupService.resolveBackupFile('not-a-zip.txt'), /Ungültiger Backupname|Ungültiger Backup-Name|Backup muss eine ZIP-Datei sein/);
});
