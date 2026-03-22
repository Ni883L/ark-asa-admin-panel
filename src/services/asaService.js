const fs = require('fs');
const path = require('path');
const defaults = require('../config/defaults');
const store = require('./store');
const powershell = require('./powershell');
const logger = require('./logger');
const { sanitizeName, sanitizePort } = require('../util/validators');

function getProfileCommand(profile) {
  if (profile.rawCommandLine) return profile.rawCommandLine;
  const args = [];
  args.push(`${profile.map}?listen?SessionName=${profile.sessionName}`);
  args.push(`Port=${profile.ports.game}`);
  args.push(`QueryPort=${profile.ports.query}`);
  if (profile.serverPassword) args.push(`ServerPassword=${profile.serverPassword}`);
  if (profile.adminPassword) args.push(`ServerAdminPassword=${profile.adminPassword}`);
  if (profile.clusterId) args.push(`ClusterId=${profile.clusterId}`);
  const extra = (profile.extraArgs || '').trim();
  return `\"${defaults.asa.exe}\" ${args.join('?')} ${extra}`.trim();
}

function getProfileSummary() {
  const data = store.getProfiles();
  return data;
}

function saveProfiles(nextData) {
  nextData.profiles = nextData.profiles.map(profile => ({
    ...profile,
    name: sanitizeName(profile.name, 'Profilname'),
    sessionName: sanitizeName(profile.sessionName, 'SessionName'),
    ports: {
      game: sanitizePort(profile.ports.game, 'Game-Port'),
      query: sanitizePort(profile.ports.query, 'Query-Port'),
      rcon: sanitizePort(profile.ports.rcon, 'RCON-Port')
    }
  }));
  store.saveProfiles(nextData);
  logger.audit('system', 'save-profiles', { count: nextData.profiles.length });
  return nextData;
}

async function getStatus() {
  const result = await powershell.run('status.ps1');
  const lines = result.stdout.split(/\r?\n/).filter(Boolean);
  const parsed = {};
  for (const line of lines) {
    const [key, ...rest] = line.split('=');
    parsed[key] = rest.join('=');
  }
  const profile = store.getActiveProfile();
  return {
    ...parsed,
    activeProfile: profile,
    commandLine: profile ? getProfileCommand(profile) : ''
  };
}

async function startServer() {
  const profile = store.getActiveProfile();
  const result = await powershell.run('start-server.ps1', [getProfileCommand(profile)]);
  logger.audit('system', 'server-start');
  return result;
}

async function stopServer() {
  const result = await powershell.run('stop-server.ps1');
  logger.audit('system', 'server-stop');
  return result;
}

async function restartServer() {
  const profile = store.getActiveProfile();
  const result = await powershell.run('restart-server.ps1', [getProfileCommand(profile)]);
  logger.audit('system', 'server-restart');
  return result;
}

async function rebootHost() {
  const result = await powershell.run('reboot-host.ps1');
  logger.audit('system', 'host-reboot');
  return result;
}

function readIni(filename) {
  const file = path.join(defaults.asa.configDir, filename);
  const exists = fs.existsSync(file);
  return { file, exists, content: exists ? fs.readFileSync(file, 'utf8') : '' };
}

function writeIni(filename, content) {
  const validation = validateArkIni(content);
  const file = path.join(defaults.asa.configDir, filename);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (fs.existsSync(file)) {
    const backup = `${file}.${Date.now()}.bak`;
    fs.copyFileSync(file, backup);
  }
  fs.writeFileSync(file, content, 'utf8');
  logger.audit('system', 'write-ini', { file, warnings: validation.warnings.length });
  return { ok: true, file, warnings: validation.warnings };
}

async function installOrUpdateServer() {
  const result = await powershell.run('steamcmd-install-or-update.ps1');
  logger.audit('system', 'asa-install-or-update');
  return result;
}

async function selfUpdate() {
  const result = await powershell.run('update.ps1');
  logger.audit('system', 'panel-update');
  return result;
}

module.exports = { getProfileSummary, saveProfiles, getStatus, startServer, stopServer, restartServer, rebootHost, readIni, writeIni, installOrUpdateServer, selfUpdate, getProfileCommand };
tStatus, startServer, stopServer, restartServer, rebootHost, readIni, writeIni, installOrUpdateServer, selfUpdate, getProfileCommand };
