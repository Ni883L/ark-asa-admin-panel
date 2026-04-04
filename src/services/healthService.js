const net = require('net');
const defaults = require('../config/defaults');
const monitorService = require('./monitorService');
const { getRuntimeWarnings } = require('../util/runtimeWarnings');

function checkPort(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;
    const finish = (ok) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

async function getHealth() {
  const metrics = await monitorService.getMetrics();
  const warnings = getRuntimeWarnings();
  const portsToCheck = [];
  const portsField = String(metrics.arkReachabilityPorts || metrics.udpPortsRaw || metrics.portsRaw || '').split(',').filter(Boolean);
  for (const item of portsField) {
    const [name, port] = item.split(':');
    const portNumber = Number(port);
    if (!Number.isInteger(portNumber) || portNumber < 1 || portNumber > 65535) continue;
    portsToCheck.push({ name, port: portNumber });
  }
  const checks = await Promise.all(portsToCheck.map(async ({ name, port }) => ({
    name,
    port,
    open: await checkPort('127.0.0.1', port)
  })));
  return {
    metrics,
    ports: checks,
    warnings,
    overall: checks.every(item => item.open) && warnings.length === 0 ? 'ok' : 'degraded'
  };
}

module.exports = { getHealth };
