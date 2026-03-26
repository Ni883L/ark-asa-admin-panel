const test = require('node:test');
const assert = require('node:assert/strict');
const schedulerRunnerService = require('../src/services/schedulerRunnerService');

test('parseSchedule supports interval and daily formats', () => {
  assert.deepEqual(schedulerRunnerService.parseSchedule('every:15m'), { type: 'interval', minutes: 15 });
  assert.deepEqual(schedulerRunnerService.parseSchedule('daily:04:30'), { type: 'daily', hour: 4, minute: 30 });
  assert.equal(schedulerRunnerService.parseSchedule('invalid'), null);
});

test('isTaskDue works for interval tasks', () => {
  const now = new Date('2026-03-26T12:00:00.000Z');
  const task = { enabled: true, cronLike: 'every:30m' };
  assert.equal(schedulerRunnerService.isTaskDue(task, now, null), true);
  assert.equal(schedulerRunnerService.isTaskDue(task, now, '2026-03-26T11:45:00.000Z'), false);
  assert.equal(schedulerRunnerService.isTaskDue(task, now, '2026-03-26T11:20:00.000Z'), true);
});

test('isTaskDue works for daily tasks', () => {
  const task = { enabled: true, cronLike: 'daily:04:30' };
  assert.equal(schedulerRunnerService.isTaskDue(task, new Date('2026-03-26T03:00:00.000Z'), null), false);
  assert.equal(schedulerRunnerService.isTaskDue(task, new Date('2026-03-26T05:00:00.000Z'), null), true);
  assert.equal(schedulerRunnerService.isTaskDue(task, new Date('2026-03-26T05:00:00.000Z'), '2026-03-26T04:45:00.000Z'), false);
  assert.equal(schedulerRunnerService.isTaskDue(task, new Date('2026-03-27T05:00:00.000Z'), '2026-03-26T04:45:00.000Z'), true);
});

test('runTaskNow throws for missing task id', async () => {
  await assert.rejects(
    schedulerRunnerService.runTaskNow('missing-task'),
    /Task nicht gefunden/
  );
});
