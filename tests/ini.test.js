const test = require('node:test');
const assert = require('node:assert/strict');
const { validateArkIni } = require('../src/util/ini');

test('validateArkIni reports duplicate keys', () => {
  const result = validateArkIni('[ServerSettings]\nSessionName=One\nSessionName=Two\n');
  assert.equal(result.warnings.length > 0, true);
});
