const fs = require('fs');
const { spawnSync } = require('child_process');
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
  const current = getPanelVersion();
  const latest = getLatestPanelVersion();
  return {
    panel: {
      current,
      latest,
      updateAvailable: latest !== 'unknown' && latest !== current
    },
    server: getServerBuildInfo()
  };
}

function runGit(args) {
  const result = spawnSync('git', args, { encoding: 'utf8', timeout: 5000 });
  if (result.status !== 0) return null;
  return String(result.stdout || '').trim();
}

function getLatestPanelVersion() {
  const localTag = runGit(['describe', '--tags', '--abbrev=0']);
  const remoteTag = runGit(['ls-remote', '--tags', '--sort=-v:refname', 'origin']);
  if (remoteTag) {
    const line = remoteTag.split(/\r?\n/).find(Boolean);
    if (line) {
      const ref = line.split(/\s+/)[1] || '';
      const tag = ref.replace('refs/tags/', '').replace(/\^\{\}$/, '').trim();
      if (tag) return tag;
    }
  }
  return localTag || 'unknown';
}

module.exports = { getPanelVersion, getServerBuildInfo, getUpdateInfo, getLatestPanelVersion };
