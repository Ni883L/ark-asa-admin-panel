const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');

const rootDir = path.resolve(__dirname, '..', '..');
const scriptsDir = path.join(rootDir, 'scripts');

function runPowerShell(scriptName, args = []) {
  const scriptPath = path.join(scriptsDir, scriptName);

  return new Promise((resolve, reject) => {
    execFile(
      'powershell',
      ['-ExecutionPolicy', 'Bypass', '-File', scriptPath, ...args],
      { env: process.env },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error((stderr || error.message || 'PowerShell execution failed').trim()));
          return;
        }

        resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
      }
    );
  });
}

async function getStatus() {
  const result = await runPowerShell('server-status.ps1');
  return {
    service: process.env.ARK_SERVER_SERVICE_NAME || '',
    status: result.stdout || 'unknown',
    serverName: process.env.ARK_SERVER_NAME || 'ASA Server'
  };
}

async function startServer() {
  return runPowerShell('start-server.ps1');
}

async function stopServer() {
  return runPowerShell('stop-server.ps1');
}

async function restartServer() {
  return runPowerShell('restart-server.ps1');
}

async function rebootHost() {
  return runPowerShell('reboot-host.ps1');
}

async function readLog(lines = 200) {
  const result = await runPowerShell('read-log.ps1', [String(lines)]);
  return result.stdout;
}

function getConfig() {
  return {
    serverPath: process.env.ARK_SERVER_PATH || '',
    serviceName: process.env.ARK_SERVER_SERVICE_NAME || '',
    executable: process.env.ARK_SERVER_EXE || '',
    logPath: process.env.ARK_LOG_PATH || '',
    rconHost: process.env.RCON_HOST || '127.0.0.1',
    rconPort: process.env.RCON_PORT || '27020'
  };
}

function readServerIni() {
  const iniPath = path.join(
    process.env.ARK_SERVER_PATH || '',
    'ShooterGame',
    'Saved',
    'Config',
    'WindowsServer',
    'GameUserSettings.ini'
  );

  if (!iniPath || !fs.existsSync(iniPath)) {
    return { path: iniPath, exists: false, content: '' };
  }

  return {
    path: iniPath,
    exists: true,
    content: fs.readFileSync(iniPath, 'utf8')
  };
}

module.exports = {
  getStatus,
  startServer,
  stopServer,
  restartServer,
  rebootHost,
  readLog,
  getConfig,
  readServerIni
};
