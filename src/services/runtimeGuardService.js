const fs = require('fs');
const defaults = require('../config/defaults');
const store = require('./store');

function validateRuntimePaths() {
  const profile = store.getActiveProfile();
  const checks = {
    asaRootExists: fs.existsSync(defaults.asa.root),
    asaExeExists: fs.existsSync(defaults.asa.exe),
    configDirExists: fs.existsSync(defaults.asa.configDir),
    logPathExists: fs.existsSync(defaults.asa.logPath),
    savedArksExists: fs.existsSync(defaults.asa.savedArksPath),
    activeProfilePresent: !!profile
  };

  const errors = [];
  const warnings = [];
  if (!checks.asaRootExists) errors.push('ASA_SERVER_ROOT nicht gefunden.');
  if (!checks.asaExeExists && !defaults.asa.serviceName) errors.push('ASA_SERVER_EXE nicht gefunden und kein Dienstname gesetzt.');
  if (!checks.configDirExists) errors.push('ASA_CONFIG_DIR nicht gefunden.');
  if (!checks.savedArksExists) warnings.push('ASA_SAVEDARKS_PATH nicht gefunden (Start trotzdem möglich, wird bei Bedarf erstellt).');
  if (!checks.activeProfilePresent) errors.push('Kein aktives Profil vorhanden.');

  return { ok: errors.length === 0, checks, errors, warnings };
}

module.exports = { validateRuntimePaths };
