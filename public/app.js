async function getJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'Unbekannter Fehler');
  }
  return data;
}

async function loadStatus() {
  const status = await getJson('/api/status');
  document.getElementById('status').textContent = `${status.serverName}: ${status.status}`;
}

async function loadConfig() {
  const config = await getJson('/api/config');
  document.getElementById('config').textContent = JSON.stringify(config, null, 2);
}

async function loadServerIni() {
  const ini = await getJson('/api/server-ini');
  if (!ini.exists) {
    document.getElementById('serverIni').textContent = `Nicht gefunden: ${ini.path}`;
    return;
  }
  document.getElementById('serverIni').textContent = ini.content;
}

async function loadLogs() {
  const logs = await getJson('/api/logs?lines=200');
  document.getElementById('logs').textContent = logs.log || '(leer)';
}

async function runAction(action) {
  if (action === 'refresh') {
    await Promise.all([loadStatus(), loadConfig(), loadServerIni(), loadLogs()]);
    return;
  }

  if (action === 'logs') {
    await loadLogs();
    return;
  }

  if (action === 'reboot-host') {
    const confirmed = window.confirm('Wirklich das komplette Windows-System neu starten?');
    if (!confirmed) {
      return;
    }
  }

  await getJson(`/api/${action}`, { method: 'POST' });
  await loadStatus();
}

async function init() {
  document.querySelectorAll('button[data-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      const action = button.dataset.action;
      button.disabled = true;
      try {
        await runAction(action);
      } catch (error) {
        alert(error.message);
      } finally {
        button.disabled = false;
      }
    });
  });

  try {
    await Promise.all([loadStatus(), loadConfig(), loadServerIni(), loadLogs()]);
  } catch (error) {
    document.getElementById('status').textContent = `Fehler: ${error.message}`;
  }
}

init();
