function parseIni(text) {
  const result = {};
  let section = 'root';
  result[section] = {};

  for (const rawLine of String(text || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith(';') || line.startsWith('#')) continue;
    if (line.startsWith('[') && line.endsWith(']')) {
      section = line.slice(1, -1).trim();
      result[section] = result[section] || {};
      continue;
    }
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (result[section][key] === undefined) {
      result[section][key] = value;
    } else if (Array.isArray(result[section][key])) {
      result[section][key].push(value);
    } else {
      result[section][key] = [result[section][key], value];
    }
  }

  return result;
}

function findDuplicateKeys(parsed) {
  const duplicates = [];
  for (const [section, entries] of Object.entries(parsed)) {
    for (const [key, value] of Object.entries(entries)) {
      if (Array.isArray(value)) duplicates.push({ section, key, count: value.length });
    }
  }
  return duplicates;
}

function validateArkIni(text) {
  const parsed = parseIni(text);
  const duplicates = findDuplicateKeys(parsed);
  const warnings = [];

  for (const duplicate of duplicates) {
    warnings.push(`Doppelter Eintrag: [${duplicate.section}] ${duplicate.key} (${duplicate.count}x)`);
  }

  if (String(text || '').length > 1024 * 1024 * 2) {
    warnings.push('INI-Datei ist ungewöhnlich groß.');
  }

  return { ok: true, warnings, parsed };
}

module.exports = { parseIni, findDuplicateKeys, validateArkIni };
