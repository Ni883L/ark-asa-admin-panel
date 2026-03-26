const test = require('node:test');
const assert = require('node:assert/strict');
const { getNextRunAt } = require('../src/util/taskSchedule');

test('getNextRunAt for interval schedule uses last run when present', () => {
  const task = { enabled: true, cronLike: 'every:30m' };
  const now = new Date('2026-03-26T12:00:00.000Z');
  assert.equal(getNextRunAt(task, now, null), '2026-03-26T12:00:00.000Z');
  assert.equal(getNextRunAt(task, now, '2026-03-26T11:45:00.000Z'), '2026-03-26T12:15:00.000Z');
});

test('getNextRunAt for daily schedule returns next valid slot', () => {
  const task = { enabled: true, cronLike: 'daily:04:30' };
  const before = new Date('2026-03-26T03:00:00.000Z');
  const after = new Date('2026-03-26T05:00:00.000Z');
  assert.equal(getNextRunAt(task, before, null), '2026-03-26T04:30:00.000Z');
  assert.equal(getNextRunAt(task, after, null), '2026-03-27T04:30:00.000Z');
});
