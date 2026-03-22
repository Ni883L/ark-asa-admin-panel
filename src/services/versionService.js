const fs = require('fs');
const path = require('path');
const pkg = require('../../package.json');
const defaults = require('../config/defaults');

function getPanelVersion() {
  return pkg.version;
}

function getServerBuildInfo() {
  const exe = defaults.asa.exe;
  if (!fs.existsSync(exe)) {
    return { installed: false, version: null, file: exe };
  }
  const stat = fs.statSync(exe);
  return { installed: true, version: stat.mtime.toISOString(), file: exe };
}

function getUpdateInfo() {
  return {
    panel: { current: getPanelVersion(), latest: 'unknown' },
    server: getServerBuildInfo()
  };
}

module.exports = { getPanelVersion, getServerBuildInfo, getUpdateInfo };
