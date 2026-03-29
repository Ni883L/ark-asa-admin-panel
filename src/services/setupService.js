const fs = require('fs');
const path = require('path');
const defaults = require('../config/defaults');
const store = require('./store');
const logger = require('./logger');
const powershell = require('./powershell');
const { sanitizePath } = require('../util/validators');

function detectServerRoot(candidatePath) {
  const root = sanitizePath(candidatePath || defaults.asa.root, 'ASA-Serverpfad');
  const exe = path.join(root, 'ShooterGame', 'Binaries', 'Win64', 'ArkAscendedServer.exe');
  const configDir = path.join(root, 'ShooterGame', 'Saved', 'Config', 'WindowsServer');
  const logPath = path.join(root, 'ShooterGame', 'Saved', 'Logs', 'ShooterGame.log');

  return {
    root,
    exists: fs.existsSync(root),
    exeExists: fs.existsSync(exe),
    configExists: fs.existsSync(configDir),
    logExists: fs.existsSync(logPath),
    exe,
    configDir,
    logPath
  };
}

function getWizardState() {
  const settings = store.getSettings();
  const detection = detectServerRoot(defaults.asa.root);
  return {
    initialized: !!settings.initialized,
    detection,
    defaults: {
      asaRoot: defaults.asa.root,
      steamCmd: defaults.asa.steamCmd,
      configDir: defaults.asa.configDir,
      logPath: defaults.asa.logPath
    }
  };
}

async function completeWizard(payload) {
  const detection = detectServerRoot(payload.asaRoot);
  const next = {
    ...store.getSettings(),
    initialized: true,
    setupCompletedAt: new Date().toISOString(),
    detectedServer: detection,
    installPath: detection.root,
    autoBackupBeforeUpdate: payload.autoBackupBeforeUpdate !== false,
    backupRetention: Number(payload.backupRetention || 14)
  };
  const steamCmdCheck = { checkedAt: new Date().toISOString(), ok: false, message: '' };
  try {
    const result = await powershell.run('steamcmd-install-or-update.ps1', ['-OnlyEnsureSteamCmd', '-InstallDir', detection.root]);
    steamCmdCheck.ok = true;
    steamCmdCheck.message = result.stdout || 'SteamCMD ist bereit.';
  } catch (error) {
    steamCmdCheck.ok = false;
    steamCmdCheck.message = error.message;
  }

  next.steamCmdCheck = steamCmdCheck;
  store.saveSettings(next);
  logger.audit('system', 'setup-complete', { root: detection.root, steamCmdOk: steamCmdCheck.ok });
  return next;
}

module.exports = { detectServerRoot, getWizardState, completeWizard };
