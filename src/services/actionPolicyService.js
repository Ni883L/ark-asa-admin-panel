function requireConfirmation(action, payload = {}) {
  const critical = new Set(['reboot-host', 'asa-update', 'panel-update', 'restore-backup']);
  if (!critical.has(action)) {
    return { ok: true, required: false };
  }

  if (payload.confirm !== true) {
    throw new Error(`Bestätigung für kritische Aktion fehlt: ${action}`);
  }

  return { ok: true, required: true };
}

module.exports = { requireConfirmation };
