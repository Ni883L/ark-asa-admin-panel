const test = require('node:test');
const assert = require('node:assert/strict');
const defaults = require('../src/config/defaults');
const authService = require('../src/services/authService');

test('normalizeIp strips mapped-ipv4 and port', () => {
  assert.equal(authService.normalizeIp('::ffff:192.168.1.22'), '192.168.1.22');
  assert.equal(authService.normalizeIp('192.168.1.22:5050'), '192.168.1.22');
});

test('getClientIp only trusts x-forwarded-for when trustProxy=true', () => {
  const original = defaults.app.trustProxy;
  const req = {
    headers: { 'x-forwarded-for': '8.8.8.8, 10.0.0.1' },
    socket: { remoteAddress: '192.168.0.20' }
  };
  defaults.app.trustProxy = false;
  assert.equal(authService.getClientIp(req), '192.168.0.20');
  defaults.app.trustProxy = true;
  assert.equal(authService.getClientIp(req), '8.8.8.8');
  defaults.app.trustProxy = original;
});
