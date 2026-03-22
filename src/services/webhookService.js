const defaults = require('../config/defaults');

async function notify(title, description) {
  if (!defaults.integrations.discordWebhookUrl) return { skipped: true };
  const payload = {
    username: 'ARK ASA Admin Panel',
    embeds: [{ title, description, timestamp: new Date().toISOString() }]
  };
  const response = await fetch(defaults.integrations.discordWebhookUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return { ok: response.ok, status: response.status };
}

module.exports = { notify };
