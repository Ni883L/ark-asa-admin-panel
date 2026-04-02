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
  const manifestCandidates = roots.map((root) => path.join(root, 'steamapps', `appmanifest_${defaults.asa.appId || '2430930'}.acf`));
  let installedBuild = null;
  for (const manifestPath of manifestCandidates) {
    if (!manifestPath || !fs.existsSync(manifestPath)) continue;
    const content = fs.readFileSync(manifestPath, 'utf8');
    const match = content.match(/"buildid"\s+"(\d+)"/i);
    if (match && match[1]) {
      installedBuild = match[1];
      break;
    }
  }

  let logVersion = null;
  if (defaults.asa.logPath && fs.existsSync(defaults.asa.logPath)) {
    const tail = fs.readFileSync(defaults.asa.logPath, 'utf8').split(/\r?\n/).slice(-600).join('\n');
    const match = tail.match(/ASA Version\s+([^\r\n]+)/i);
    if (match && match[1]) logVersion = match[1].trim();
  }

  if (!fs.existsSync(exe)) {
    return {
      installed: false,
      version: logVersion || (installedBuild ? `Build ${installedBuild}` : null),
      buildId: installedBuild,
      source: logVersion ? 'log' : 'manifest',
      file: exe
    };
  }

  let fileVersion = null;
  const escapedExe = exe.replace(/'/g, "''");
  const ps = spawnSync('powershell', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    `(Get-Item '${escapedExe}').VersionInfo.ProductVersion`
  ], { encoding: 'utf8', timeout: 5000, windowsHide: true });
  const stdout = String(ps.stdout || '').trim();
  if (ps.status === 0 && stdout) fileVersion = stdout;

  const versionLabel = logVersion || fileVersion || null;
  const displayVersion = versionLabel || (installedBuild ? `Build ${installedBuild}` : null);

  return {
    installed: true,
    version: displayVersion || null,
    rawVersion: versionLabel,
    buildId: installedBuild,
    source: logVersion ? 'log' : (fileVersion ? 'file' : (installedBuild ? 'manifest' : 'unknown')),
    file: exe
  };
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
