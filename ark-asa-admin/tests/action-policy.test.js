const test = require('node:test');
const assert = require('node:assert/strict');
const { requireConfirmation } = require('../src/services/actionPolicyService');

test('critical action requires confirmation', () => {
  assert.throws(() => requireConfirmation('reboot-host', {}));
  assert.deepEqual(requireConfirmation('reboot-host', { confirm: true }), { ok: true, required: true });
});

test('non critical action does not require confirmation', () => {
  assert.deepEqual(requireConfirmation('start', {}), { ok: true, required: false });
});
