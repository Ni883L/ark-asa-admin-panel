const fs = require('fs');
const defaults = require('../config/defaults');
const store = require('./store');
const powershell = require('./powershell');

function clampLines(lines, fallback = 200, max = 2000) {
  const parsed = Number(lines);
  if (!Number.isInteger(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

function deriveServerReadiness(metrics = {}, logText = '') {
  const status = String(metrics.status || '').toLowerCase();
  const crashDetected = String(metrics.crashDetected || '').toLowerCase() === 'true';
  const portsKnown = String(metrics.ports || '').toLowerCase() !== 'unknown';
  const mapLoaded = String(metrics.mapLoaded || '').toLowerCase() === 'true';
  const lowerLog = String(logText || '').toLowerCase();
  const mapName = metrics.loadedMap || metrics.mapName || '';
  const currentRunOnly = String(metrics.currentRunCrashDetected || '').toLowerCase() === 'true';

  if (crashDetected && currentRunOnly) {
    return { state: 'error', label: 'Fehler / Crash erkannt', detail: 'Logs des aktuellen Laufs deuten auf Crash oder fatalen Fehler hin.' };
  }
  if (!status || status === 'stopped' || status === 'stop_pending') {
    return { state: 'offline', label: 'Gestoppt', detail: 'Server ist aktuell nicht gestartet.' };
  }
  if (status === 'start_pending') {
    return { state: 'starting', label: 'Startet', detail: 'Server wird gestartet.' };
  }
  if (status === 'running') {
    if (mapLoaded) {
      return { state: 'ready', label: 'Läuft / Karte geladen', detail: mapName ? `Server läuft, Karte ${mapName} ist geladen.` : 'Server läuft und die Karte ist geladen.' };
    }
    if (portsKnown || lowerLog.includes('listening') || lowerLog.includes('primal game data took')) {
      return { state: 'loading', label: 'Läuft / lädt noch', detail: 'Serverprozess läuft, Karte oder Dienste laden noch.' };
    }
    return { state: 'running', label: 'Läuft', detail: 'Serverprozess läuft, Ladezustand noch unklar.' };
  }
  return { state: 'unknown', label: 'Status unklar', detail: `Rohstatus: ${metrics.status || 'unbekannt'}` };
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
  const profile = store.getActiveProfile();
  if (profile?.ports) {
    parsed.configuredPorts = `Game ${profile.ports.game} · Query ${profile.ports.query}${profile.ports.rcon ? ` · RCON ${profile.ports.rcon}` : ''}`;
    parsed.configuredPortsRaw = JSON.stringify(profile.ports);
  }
  const recentLog = getRecentLogs(300);
  parsed.readiness = deriveServerReadiness(parsed, recentLog);
  parsed.displayPorts = parsed.ports || parsed.configuredPorts || 'unknown';
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

module.exports = { getMetrics, getRecentLogs, parsePlayers, clampLines, deriveServerReadiness };
