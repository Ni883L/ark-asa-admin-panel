const test = require('node:test');
const assert = require('node:assert/strict');
const schedulerService = require('../src/services/schedulerService');

test('normalizeTaskType accepts supported values', () => {
  assert.equal(schedulerService.normalizeTaskType('backup'), 'backup');
  assert.equal(schedulerService.normalizeTaskType('asa-update'), 'asa-update');
});

test('normalizeTaskType rejects unsupported values', () => {
  assert.throws(() => schedulerService.normalizeTaskType('unknown'), /Task-Typ nicht unterstützt/);
});

test('normalizeSchedule validates supported formats', () => {
  assert.equal(schedulerService.normalizeSchedule('every:15m'), 'every:15m');
  assert.equal(schedulerService.normalizeSchedule('daily:04:30'), 'daily:04:30');
  assert.throws(() => schedulerService.normalizeSchedule('*/5 * * * *'), /Ungültiges Zeitformat/);
});
