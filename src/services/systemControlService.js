const logger = require('./logger');
const powershell = require('./powershell');
const actionPolicyService = require('./actionPolicyService');

async function rebootHost(payload = {}) {
  actionPolicyService.requireConfirmation('reboot-host', payload);
  const delaySeconds = Number(payload.delaySeconds || 0);
  const result = delaySeconds > 0
    ? await powershell.run('reboot-host-delayed.ps1', [String(delaySeconds)])
    : await powershell.run('reboot-host.ps1');
  logger.audit('system', 'host-reboot', { delaySeconds });
  return result;
}

module.exports = { rebootHost };
