const fs = require('fs');
const defaults = require('../config/defaults');
const powershell = require('./powershell');

async function getMetrics() {
  const result = await powershell.run('status.ps1');
  const parsed = {};
  for (const line of result.stdout.split(/\r?\n/)) {
    if (!line.includes('=')) continue;
    const [key, ...rest] = line.split('=');
    parsed[key] = rest.join('=');
  }
  parsed.portChecks = String(parsed.portsRaw || '').split(',').filter(Boolean);
  return parsed;
}

function getRecentLogs(lines = 200) {
  if (!fs.existsSync(defaults.asa.logPath)) return '';
  return fs.readFileSync(defaults.asa.logPath, 'utf8').split(/\r?\n/).slice(-lines).join('\n');
}

function parsePlayers() {
  const logText = getRecentLogs(1000);
  const lines = logText.split(/\r?\n/);
  const players = [];
  for (const line of lines) {
    const match = line.match(/Player connected: (.+?) \((.+?)\)/i);
    if (match) {
      players.push({ name: match[1], id: match[2], lastSeen: new Date().toISOString(), source: 'log' });
    }
  }
  return players.slice(-50).reverse();
}

module.exports = { getMetrics, getRecentLogs, parsePlayers };
