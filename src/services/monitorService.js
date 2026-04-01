const fs = require('fs');
const defaults = require('../config/defaults');
const powershell = require('./powershell');

function clampLines(lines, fallback = 200, max = 2000) {
  const parsed = Number(lines);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

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
  const safeLines = clampLines(lines, 200, 5000);
  if (!fs.existsSync(defaults.asa.logPath)) return '';
  return fs.readFileSync(defaults.asa.logPath, 'utf8').split(/\r?\n/).slice(-safeLines).join('\n');
}

function parsePlayers() {
  const logText = getRecentLogs(1000);
  const lines = logText.split(/\r?\n/);
  const players = [];
  const seen = new Set();
  for (const line of lines) {
    const match = line.match(/Player connected: (.+?) \((.+?)\)/i);
    if (!match) continue;
    const id = String(match[2] || '').trim();
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    players.push({ name: match[1], id, lastSeen: new Date().toISOString(), source: 'log' });
  }
  return players.slice(-50).reverse();
}

module.exports = { getMetrics, getRecentLogs, parsePlayers, clampLines };
