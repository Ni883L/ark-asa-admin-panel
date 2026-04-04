const fs = require('fs');
const path = require('path');
const defaults = require('../config/defaults');
const store = require('./store');
const powershell = require('./powershell');
const logger = require('./logger');
const backupService = require('./backupService');
const runtimeGuardService = require('./runtimeGuardService');
const { validateArkIni } = require('../util/ini');
const { sanitizeName, sanitizePort, requireString } = require('../util/validators');
const { spawn } = require('child_process');

function getEffectiveAsaRoot() {
  const settings = store.getSettings();
  const candidates = [
    settings?.detectedServer?.root,
    defaults.asa.root,
    defaults.asa.configDir ? path.resolve(defaults.asa.configDir, '..', '..', '..', '..') : null
  ].filter(Boolean);

  for (const candidate of candidates) {
    const exe = path.join(candidate, 'ShooterGame', 'Binaries', 'Win64', 'ArkAscendedServer.exe');
    if (fs.existsSync(exe)) return candidate;
  }

  return candidates[0] || defaults.asa.root;
}

function resolveAsaExePath() {
  if (defaults.asa.exe && fs.existsSync(defaults.asa.exe)) return defaults.asa.exe;
  return path.join(getEffectiveAsaRoot(), 'ShooterGame', 'Binaries', 'Win64', 'ArkAscendedServer.exe');
}

function getProfileCommand(profile) {
  if (!profile) return '';
  const args = [];
  args.push(`${profile.map}?listen?SessionName=${profile.sessionName}`);
  args.push(`Port=${profile.ports.game}`);
  args.push(`QueryPort=${profile.ports.query}`);
  if (profile.ports?.rcon) args.push(`RCONPort=${profile.ports.rcon}`);
  if (profile.serverPassword) args.push(`ServerPassword=${profile.serverPassword}`);
  if (profile.adminPassword) args.push(`ServerAdminPassword=${profile.adminPassword}`);
  if (profile.clusterId) args.push(`ClusterId=${profile.clusterId}`);
  const extra = (profile.extraArgs || '').trim();
  return `"${resolveAsaExePath()}" ${args.join('?')} ${extra}`.trim();
}


function ensureRuntimePathsAndIniFiles() {
  fs.mkdirSync(defaults.asa.configDir, { recursive: true });
  if (defaults.asa.savedArksPath) {
    fs.mkdirSync(defaults.asa.savedArksPath, { recursive: true });
  }

  const iniDefaults = {
    'GameUserSettings.ini': '[ServerSettings]\n',
    'Game.ini': '[/Script/ShooterGame.ShooterGameMode]\n',
    'Engine.ini': '[/Script/Engine.GameEngine]\n'
  };

  for (const [name, fallback] of Object.entries(iniDefaults)) {
    const file = path.join(defaults.asa.configDir, name);
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, fallback, 'utf8');
    }
  }
}

function getProfileSummary() {
  return store.getProfiles();
}

function saveProfiles(nextData) {
  if (!nextData || !Array.isArray(nextData.profiles) || !nextData.profiles.length) {
    throw new Error('Mindestens ein Serverprofil ist erforderlich.');
  }

  nextData.profiles = nextData.profiles.map((profile) => {
    const normalized = {
      ...profile,
      rawCommandLine: '',
      id: requireString(profile.id, 'Profil-ID'),
      map: requireString(profile.map, 'Map'),
      name: sanitizeName(profile.name, 'Profilname'),
      sessionName: sanitizeName(profile.sessionName, 'SessionName'),
      ports: {
        game: sanitizePort(profile.ports.game, 'Game-Port'),
        query: sanitizePort(profile.ports.query, 'Query-Port'),
        rcon: sanitizePort(profile.ports.rcon, 'RCON-Port')
      }
    };
    return normalized;
  });

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
  const profilePorts = profile?.ports
    ? `Game ${profile.ports.game} · Query ${profile.ports.query}${profile.ports.rcon ? ` · RCON ${profile.ports.rcon}` : ''}`
    : '';
  return {
    ...parsed,
    activeProfile: profile,
    commandLine: profile ? getProfileCommand(profile) : '',
    configuredPorts: profilePorts || parsed.configuredPorts || 'unknown',
    configuredPortsRaw: profile?.ports ? JSON.stringify(profile.ports) : (parsed.configuredPortsRaw || '')
  };
}

async function startServer() {
  ensureRuntimePathsAndIniFiles();
  let guard = runtimeGuardService.validateRuntimePaths();
  const missingExe = guard.errors.some((entry) => entry.includes('ASA_SERVER_EXE nicht gefunden'));
  if (!guard.ok && missingExe) {
    logger.info('ASA executable missing before start; trying SteamCMD install/update once.');
    await powershell.run('steamcmd-install-or-update.ps1');
    guard = runtimeGuardService.validateRuntimePaths();
  }
  if (!guard.ok) throw new Error(`Start abgebrochen: ${guard.errors.join(' | ')}`);
  const profile = store.getActiveProfile();
  const command = getProfileCommand(profile);
  logger.info('Starting ASA with profile command', { command, profileId: profile?.id, ports: profile?.ports });
  const result = await powershell.run('start-server.ps1', [command]);
  logger.audit('system', 'server-start', { guard, command, ports: profile?.ports });
  return result;
}

async function stopServer() {
  const result = await powershell.run('stop-server.ps1');
  logger.audit('system', 'server-stop');
  return result;
}

async function restartServer() {
  ensureRuntimePathsAndIniFiles();
  const guard = runtimeGuardService.validateRuntimePaths();
  if (!guard.ok) throw new Error(`Restart abgebrochen: ${guard.errors.join(' | ')}`);
  const profile = store.getActiveProfile();
  const command = getProfileCommand(profile);
  logger.info('Restarting ASA with profile command', { command, profileId: profile?.id, ports: profile?.ports });
  const result = await powershell.run('restart-server.ps1', [command]);
  logger.audit('system', 'server-restart', { guard, command, ports: profile?.ports });
  return result;
}

async function rebootHost(payload = {}) {
  const actionPolicyService = require('./actionPolicyService');
  actionPolicyService.requireConfirmation('reboot-host', payload);
  const delaySeconds = Number(payload.delaySeconds || 0);
  const result = delaySeconds > 0
    ? await powershell.run('reboot-host-delayed.ps1', [String(delaySeconds)])
    : await powershell.run('reboot-host.ps1');
  logger.audit('system', 'host-reboot', { delaySeconds });
  return result;
}

function readIni(filename) {
  ensureRuntimePathsAndIniFiles();
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
  const status = await getStatus();
  const normalizedStatus = String(status.status || '').toLowerCase();
  if (normalizedStatus && normalizedStatus !== 'stopped') {
    throw new Error(`ASA-Update nur im Stop-Zustand erlaubt. Aktueller Status: ${status.status || 'unbekannt'}`);
  }
  await backupService.createBackup('pre-asa-update');
  const result = await powershell.run('steamcmd-install-or-update.ps1');
  logger.audit('system', 'asa-install-or-update');
  return result;
}

async function checkForServerUpdate() {
  const result = await powershell.run('steamcmd-check-update.ps1');
  let parsed = {};
  try {
    parsed = JSON.parse(result.stdout || '{}');
  } catch (_error) {
    throw new Error(`Update-Check konnte nicht gelesen werden: ${result.stdout}`);
  }
  logger.audit('system', 'asa-update-check', { updateAvailable: !!parsed.updateAvailable });
  return parsed;
}

async function selfUpdate() {
  const result = await powershell.run('update.ps1');
  logger.audit('system', 'panel-update');
  return result;
}

async function updateAndRestartPanel() {
  const result = await powershell.run('panel-update-launcher.ps1', ['-InstallPath', process.cwd(), '-Branch', 'main']);
  logger.audit('system', 'panel-update-launcher', { port: defaults.app.port });
  return result;
}

async function restartPanelService() {
  try {
    const serviceStatus = JSON.parse((await powershell.run('panel-service.ps1', ['-Mode', 'Status', '-InstallPath', process.cwd()])).stdout || '{}');
    if (serviceStatus.exists) {
      const result = await powershell.run('panel-service.ps1', ['-Mode', 'Restart', '-InstallPath', process.cwd()]);
      logger.audit('system', 'panel-restart-service', { port: defaults.app.port, mode: 'service' });
      return result;
    }
  } catch (_error) {
    // fallback below
  }
  const result = await powershell.run('panel-restart.ps1', ['-Port', String(defaults.app.port)]);
  logger.audit('system', 'panel-restart-service', { port: defaults.app.port, mode: 'legacy-task' });
  return result;
}

async function checkPanelFirewall(port) {
  const result = await powershell.run('panel-firewall.ps1', ['-Mode', 'Check', '-Port', String(port)]);
  return JSON.parse(result.stdout || '{}');
}

async function openPanelFirewall(port) {
  const result = await powershell.run('panel-firewall.ps1', ['-Mode', 'Open', '-Port', String(port)]);
  return JSON.parse(result.stdout || '{}');
}

async function getPanelAutostartStatus() {
  const result = await powershell.run('panel-service.ps1', ['-Mode', 'Status', '-InstallPath', process.cwd()]);
  return JSON.parse(result.stdout || '{}');
}

async function setPanelAutostart(enabled) {
  const mode = enabled ? 'ElevateInstall' : 'ElevateUninstall';
  const result = await powershell.run('panel-service.ps1', ['-Mode', mode, '-InstallPath', process.cwd()]);
  logger.audit('system', 'panel-autostart', { enabled: !!enabled, type: 'service', elevated: true });
  return JSON.parse(result.stdout || '{}');
}

async function getAsaAutostartStatus() {
  const result = await powershell.run('asa-service.ps1', ['-Mode', 'Status']);
  return JSON.parse(result.stdout || '{}');
}

async function setAsaAutostart(enabled) {
  const profile = store.getActiveProfile();
  const command = getProfileCommand(profile).replace(/^"[^"]+"\s*/, '');
  const mode = enabled ? 'ElevateInstall' : 'ElevateUninstall';
  const result = await powershell.run('asa-service.ps1', ['-Mode', mode, '-CommandLine', command]);
  logger.audit('system', 'asa-autostart', { enabled: !!enabled, type: 'service', elevated: true, command, ports: profile?.ports });
  return JSON.parse(result.stdout || '{}');
}

module.exports = {
  getProfileSummary,
  saveProfiles,
  getStatus,
  startServer,
  stopServer,
  restartServer,
  rebootHost,
  readIni,
  writeIni,
  installOrUpdateServer,
  checkForServerUpdate,
  selfUpdate,
  updateAndRestartPanel,
  restartPanelService,
  checkPanelFirewall,
  openPanelFirewall,
  getPanelAutostartStatus,
  setPanelAutostart,
  getAsaAutostartStatus,
  setAsaAutostart,
  getProfileCommand
};
