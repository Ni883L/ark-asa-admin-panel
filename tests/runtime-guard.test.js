const test = require('node:test');
const assert = require('node:assert/strict');
const { validateRuntimePaths } = require('../src/services/runtimeGuardService');

test('validateRuntimePaths returns structured result', () => {
  const result = validateRuntimePaths();
  assert.equal(typeof result.ok, 'boolean');
  assert.equal(Array.isArray(result.errors), true);
  assert.equal(typeof result.checks, 'object');
});
