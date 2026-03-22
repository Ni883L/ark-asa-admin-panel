function requireString(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} ist erforderlich.`);
  }
  return value.trim();
}

function sanitizeName(value, field = 'Name') {
  const normalized = requireString(value, field);
  if (!/^[a-zA-Z0-9._ -]{1,100}$/.test(normalized)) {
    throw new Error(`${field} enthält ungültige Zeichen.`);
  }
  return normalized;
}

function sanitizePath(value, field = 'Pfad') {
  const normalized = requireString(value, field);
  if (/[<>|?*]/.test(normalized)) {
    throw new Error(`${field} enthält ungültige Zeichen.`);
  }
  return normalized;
}

function sanitizePort(value, field = 'Port') {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1 || num > 65535) {
    throw new Error(`${field} ist ungültig.`);
  }
  return num;
}

module.exports = { requireString, sanitizeName, sanitizePath, sanitizePort };
