const { execFile } = require('child_process');
const path = require('path');

const scriptsDir = path.resolve(__dirname, '..', '..', 'scripts');

function run(scriptName, args = [], options = {}) {
  return new Promise((resolve, reject) => {
    const file = path.join(scriptsDir, scriptName);
    execFile('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', file, ...args], { env: process.env, maxBuffer: 1024 * 1024 * 10, windowsHide: true, ...options }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error((stderr || stdout || error.message).trim()));
        return;
      }
      resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
    });
  });
}

module.exports = { run };
