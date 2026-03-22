const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizePort, sanitizeName } = require('../src/util/validators');

test('sanitizePort accepts valid ranges', () => {
  assert.equal(sanitizePort(27015), 27015);
});

test('sanitizeName rejects bad characters', () => {
  assert.throws(() => sanitizeName('bad/name'));
});
