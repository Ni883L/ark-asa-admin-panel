const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const pkg = require('../../package.json');
const defaults = require('../config/defaults');
const store = require('./store');

function getPanelVersion() {
  return pkg.version;
}

function getServerBuildInfo() {
  const settings = store.getSettings();
  const roots = [
    settings?.detectedServer?.root,
    defaults.asa.root,
    defaults.asa.configDir ? path.resolve(defaults.asa.configDir, '..', '..', '..', '..') : null
  ].filter(Boolean);
  const exeCandidates = [
    defaults.asa.exe,
    ...roots.map((root) => path.join(root, 'ShooterGame', 'Binaries', 'Win64', 'ArkAscendedServer.exe'))
  ];
  const exe = exeCandidates.find((candidate) => candidate && fs.existsSync(candidate)) || defaults.asa.exe;
  if (!fs.existsSync(exe)) {
    return { installed: false, version: null, file: exe };
  }
  const stat = fs.statSync(exe);
  let version = null;
  if (defaults.asa.logPath && fs.existsSync(defaults.asa.logPath)) {
    const tail = fs.readFileSync(defaults.asa.logPath, 'utf8').split(/\r?\n/).slice(-400).join('\n');
    const match = tail.match(/ASA Version\s+([^\r\n]+)/i);
    if (match && match[1]) version = match[1].trim();
  }
  if (!version) {
    const escapedExe = exe.replace(/'/g, "''");
    const ps = spawnSync('powershell', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-Command',
      `(Get-Item '${escapedExe}').VersionInfo.ProductVersion`
    ], { encoding: 'utf8', timeout: 5000, windowsHide: true });
    const fileVersion = String(ps.stdout || '').trim();
    if (ps.status === 0 && fileVersion) version = fileVersion;
  }
  if (!version) version = stat.mtime.toISOString();
  return { installed: true, version, file: exe };
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
