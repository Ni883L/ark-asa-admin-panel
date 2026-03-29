const fs = require('fs');
const path = require('path');
const defaults = require('../config/defaults');
const store = require('./store');

function resolveAsaExePath() {
  if (defaults.asa.exe && fs.existsSync(defaults.asa.exe)) return defaults.asa.exe;
  const settings = store.getSettings();
  const effectiveRoot = settings?.detectedServer?.root || defaults.asa.root;
  return path.join(effectiveRoot, 'ShooterGame', 'Binaries', 'Win64', 'ArkAscendedServer.exe');
}

function validateRuntimePaths() {
  const profile = store.getActiveProfile();
  const resolvedExe = resolveAsaExePath();
  const hasCustomCommandLine = Boolean(profile?.rawCommandLine && String(profile.rawCommandLine).trim());
  const checks = {
    asaRootExists: fs.existsSync(defaults.asa.root),
    asaExeExists: hasCustomCommandLine ? true : fs.existsSync(resolvedExe),
    asaExePath: resolvedExe,
    hasCustomCommandLine,
    configDirExists: fs.existsSync(defaults.asa.configDir),
    logPathExists: fs.existsSync(defaults.asa.logPath),
    savedArksExists: fs.existsSync(defaults.asa.savedArksPath),
    activeProfilePresent: !!profile
  };

  const errors = [];
  const warnings = [];
  if (!checks.asaRootExists) errors.push('ASA_SERVER_ROOT nicht gefunden.');
  if (!checks.asaExeExists && !defaults.asa.serviceName) errors.push(`ASA_SERVER_EXE nicht gefunden (${checks.asaExePath}) und kein Dienstname gesetzt.`);
  if (!fs.existsSync(defaults.asa.exe) && checks.asaExeExists) warnings.push(`ASA_SERVER_EXE nicht gefunden, nutze automatisch ${checks.asaExePath}.`);
  if (!checks.configDirExists) errors.push('ASA_CONFIG_DIR nicht gefunden.');
  if (!checks.savedArksExists) warnings.push('ASA_SAVEDARKS_PATH nicht gefunden (Start trotzdem möglich, wird bei Bedarf erstellt).');
  if (!checks.activeProfilePresent) errors.push('Kein aktives Profil vorhanden.');

  return { ok: errors.length === 0, checks, errors, warnings };
}

module.exports = { validateRuntimePaths };
