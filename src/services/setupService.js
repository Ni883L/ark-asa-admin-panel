const fs = require('fs');
const path = require('path');
const defaults = require('../config/defaults');
const store = require('./store');
const logger = require('./logger');
const powershell = require('./powershell');
const { sanitizePath } = require('../util/validators');

function runPanelFileCheck() {
  const panelRoot = process.cwd();
  const requiredPaths = [
    '.env',
    'package.json',
    'src/server.js',
    'public/index.html',
    'scripts/start-server.ps1',
    'scripts/update.ps1'
  ];
  const checks = requiredPaths.map((relativePath) => {
    const absolutePath = path.join(panelRoot, relativePath);
    return { path: relativePath, exists: fs.existsSync(absolutePath) };
  });

  return {
    checkedAt: new Date().toISOString(),
    panelRoot,
    ok: checks.every((item) => item.exists),
    checks
  };
}

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

  const panelFileCheck = runPanelFileCheck();
  next.steamCmdCheck = steamCmdCheck;
  next.panelFileCheck = panelFileCheck;
  store.saveSettings(next);
  logger.audit('system', 'setup-complete', {
    root: detection.root,
    steamCmdOk: steamCmdCheck.ok,
    panelFileCheckOk: panelFileCheck.ok
  });
  return next;
}

module.exports = { detectServerRoot, getWizardState, completeWizard };
