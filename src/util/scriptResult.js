function parseJsonSafely(raw, fallback = {}) {
  try {
    return JSON.parse(String(raw || '').trim() || '{}');
  } catch {
    return fallback;
  }
}

function normalizeScriptError(error, fallbackMessage) {
  const message = String(error?.message || error || fallbackMessage || 'Skript fehlgeschlagen.').trim();
  return new Error(message || fallbackMessage || 'Skript fehlgeschlagen.');
}

module.exports = { parseJsonSafely, normalizeScriptError };
