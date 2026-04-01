const test = require('node:test');
const assert = require('node:assert/strict');
const { getNextRunAt } = require('../src/util/taskSchedule');

test('getNextRunAt for interval schedule uses last run when present', () => {
  const task = { enabled: true, cronLike: 'every:30m' };
  const now = new Date('2026-03-26T12:00:00.000Z');
  assert.equal(getNextRunAt(task, now, null), '2026-03-26T12:00:00.000Z');
  assert.equal(getNextRunAt(task, now, '2026-03-26T11:45:00.000Z'), '2026-03-26T12:15:00.000Z');
});

test('getNextRunAt for daily schedule returns next valid local slot', () => {
  const task = { enabled: true, cronLike: 'daily:04:30' };
  const before = new Date(2026, 2, 26, 3, 0, 0, 0);
  const after = new Date(2026, 2, 26, 5, 0, 0, 0);

  const nextBefore = new Date(getNextRunAt(task, before, null));
  const nextAfter = new Date(getNextRunAt(task, after, null));

  assert.equal(nextBefore.getHours(), 4);
  assert.equal(nextBefore.getMinutes(), 30);
  assert.equal(nextBefore.getDate(), 26);

  assert.equal(nextAfter.getHours(), 4);
  assert.equal(nextAfter.getMinutes(), 30);
  assert.equal(nextAfter.getDate(), 27);
});
