const test = require('node:test');
const assert = require('node:assert/strict');
const { detectServerRoot } = require('../src/services/setupService');

test('detectServerRoot returns structured response', () => {
  const result = detectServerRoot('C:\\ARK\\ASA');
  assert.equal(typeof result.root, 'string');
  assert.equal(typeof result.exeExists, 'boolean');
});
