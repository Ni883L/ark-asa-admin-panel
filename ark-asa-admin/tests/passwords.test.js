const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword } = require('../src/util/passwords');

test('hashPassword and verifyPassword work', () => {
  const hash = hashPassword('secret123');
  assert.equal(verifyPassword('secret123', hash), true);
  assert.equal(verifyPassword('wrong', hash), false);
});
