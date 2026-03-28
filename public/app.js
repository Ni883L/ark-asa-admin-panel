let csrfToken = null;
let currentConfig = 'GameUserSettings.ini';
let bootstrapState = null;

function setFeedback(message, type = 'info') {
  const el = document.getElementById('actionFeedback');
  if (!el) return;
  if (!message) {
    el.className = 'feedback hidden';
    el.textContent = '';
    return;
  }

  el.className = `feedback ${type}`;
  el.textContent = message;
}

function renderAccessHint() {
  const hint = document.getElementById('accessHint');
  if (!hint || !bootstrapState?.appBinding) return;

  const { host, port, httpsEnabled } = bootstrapState.appBinding;
  const scheme = httpsEnabled ? 'https' : 'http';
  if (host === '0.0.0.0' || host === '::') {
    hint.textContent = `LAN-Zugriff aktiv: ${scheme}://<server-ip>:${port}`;
  } else {
    hint.textContent = `LAN-Zugriff ist aktuell nicht aktiv (HOST=${host}). Für LAN setze HOST=0.0.0.0 und starte das Panel neu.`;
  }
}

async function api(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (csrfToken) headers['x-csrf-token'] = csrfToken;

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch (_error) {
    throw new Error('Netzwerkfehler: API nicht erreichbar.');
  }

  let data = {};
  try {
    data = await response.json();
  } catch (_error) {
    data = {};
  }

  if (!response.ok) throw new Error(data.error || `Fehler ${response.status}`);
  return data;
}

function show(viewId) {
  for (const el of document.querySelectorAll('.view')) el.classList.add('hidden');
  document.getElementById(viewId).classList.remove('hidden');
}

function renderStats(status, metrics) {
  const target = document.getElementById('statusGrid');
  const fields = {
    Serverstatus: status.status || metrics.status || 'unknown',
    Profil: status.activeProfile?.name || '-',
    CPU: metrics.cpu || '-',
    RAM: metrics.memory || '-',
    Disk: metrics.disk || '-',
    Ports: metrics.ports || '-',
    'Letzter Start': metrics.lastStart || '-',
    Crashs: metrics.crashDetected || 'unknown'
  };
  target.innerHTML = Object.entries(fields).map(([k, v]) => `<div class="stat"><strong>${k}</strong><div>${v}</div></div>`).join('');
}

function renderPlayers(players) {
  const target = document.getElementById('players');
  if (!players.length) {
    target.innerHTML = '<p>Keine Spieler erkannt.</p>';
    return;
  }
  target.innerHTML = `<div class="item-list">${players.map(player => `<div class="item"><strong>${player.name}</strong><div>ID: ${player.id || '-'}</div><div>Quelle: ${player.source}</div></div>`).join('')}</div>`;
}

function renderBackups(backups) {
  const target = document.getElementById('backups');
  target.innerHTML = `<div class="item-list">${backups.map(backup => `<div class="item"><strong>${backup.name}</strong><div>${backup.modifiedAt}</div><div>${backup.size} Bytes</div><button onclick="restoreBackup('${backup.name}')">Restore</button></div>`).join('')}</div>`;
}

async function restoreBackup(name) {
  if (!confirm(`Backup ${name} wirklich wiederherstellen?`)) return;
  try {
    await api('/api/backups/restore', { method: 'POST', body: JSON.stringify({ name, mode: 'full' }) });
    setFeedback(`Backup ${name} wurde wiederhergestellt.`, 'success');
    await refreshDashboard();
  } catch (error) {
    setFeedback(error.message, 'error');
  }
}
window.restoreBackup = restoreBackup;

async function loadConfig(name = currentConfig) {
  currentConfig = name;
  const data = await api(`/api/config/${encodeURIComponent(name)}`);
  document.getElementById('configEditor').value = data.content || '';
}

async function refreshDashboard() {
  const [data, profiles, health, versions, tasks, users, audit] = await Promise.all([
    api('/api/dashboard'),
    api('/api/profiles'),
    api('/api/health'),
    api('/api/versions'),
    api('/api/tasks'),
    api('/api/users'),
    api('/api/audit')
  ]);

  renderStats(data.status, data.metrics);
  renderPlayers(data.players);
  renderBackups(data.backups);
  renderAccessHint();
  document.getElementById('logs').textContent = data.logs || '(leer)';
  document.getElementById('profilesEditor').value = JSON.stringify(profiles, null, 2);
  document.getElementById('settingsEditor').value = JSON.stringify(data.settings, null, 2);
  document.getElementById('healthInfo').textContent = JSON.stringify(health, null, 2);
  document.getElementById('versionInfo').textContent = JSON.stringify(versions, null, 2);
  document.getElementById('tasksEditor').value = JSON.stringify(tasks.tasks || [], null, 2);
  document.getElementById('usersInfo').textContent = JSON.stringify(users.users || [], null, 2);
  document.getElementById('auditInfo').textContent = (audit.entries || []).join('\n');
  await loadConfig(currentConfig);
}

async function bootstrapAuth() {
  const me = await api('/auth/me');
  if (!me.authenticated) {
    show('loginView');
    return;
  }

  csrfToken = me.csrfToken;
  document.getElementById('welcome').textContent = `Angemeldet als ${me.user.username} (${me.user.role})`;
  bootstrapState = await api('/api/bootstrap');

  if (!bootstrapState.initialized) {
    document.getElementById('wizardAsaPath').value = bootstrapState.defaults.asaRoot || '';
    document.getElementById('wizardResult').textContent = JSON.stringify(bootstrapState.detection, null, 2);
    show('wizardView');
    return;
  }

  show('dashboardView');
  await refreshDashboard();
}

document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    const form = new FormData(event.target);
    const result = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: form.get('username'), password: form.get('password') })
    });
    csrfToken = result.user.csrfToken;
    await bootstrapAuth();
    setFeedback('', 'info');
  } catch (error) {
    setFeedback(error.message, 'error');
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  try {
    await api('/auth/logout', { method: 'POST', body: JSON.stringify({}) });
    csrfToken = null;
    show('loginView');
    setFeedback('', 'info');
  } catch (error) {
    setFeedback(error.message, 'error');
  }
});

document.getElementById('detectServerBtn').addEventListener('click', async () => {
  try {
    const result = await api('/api/detect-server', {
      method: 'POST',
      body: JSON.stringify({ path: document.getElementById('wizardAsaPath').value })
    });
    document.getElementById('wizardResult').textContent = JSON.stringify(result, null, 2);
  } catch (error) {
    document.getElementById('wizardResult').textContent = error.message;
  }
});

document.getElementById('completeWizardBtn').addEventListener('click', async () => {
  try {
    await api('/api/bootstrap', {
      method: 'POST',
      body: JSON.stringify({
        asaRoot: document.getElementById('wizardAsaPath').value,
        autoBackupBeforeUpdate: true,
        backupRetention: 14
      })
    });
    await bootstrapAuth();
  } catch (error) {
    document.getElementById('wizardResult').textContent = error.message;
  }
});

document.getElementById('refreshBtn').addEventListener('click', async () => {
  try {
    await refreshDashboard();
    setFeedback('Dashboard aktualisiert.', 'success');
  } catch (error) {
    setFeedback(error.message, 'error');
  }
});

document.getElementById('saveProfilesBtn').addEventListener('click', async () => {
  try {
    await api('/api/profiles', { method: 'POST', body: document.getElementById('profilesEditor').value });
    setFeedback('Profile gespeichert.', 'success');
  } catch (error) {
    setFeedback(error.message, 'error');
  }
});

document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  try {
    await api('/api/settings', { method: 'POST', body: document.getElementById('settingsEditor').value });
    setFeedback('Einstellungen gespeichert.', 'success');
  } catch (error) {
    setFeedback(error.message, 'error');
  }
});

document.getElementById('saveTasksBtn').addEventListener('click', async () => {
  try {
    await api('/api/tasks', {
      method: 'POST',
      body: JSON.stringify({ tasks: JSON.parse(document.getElementById('tasksEditor').value) })
    });
    setFeedback('Tasks gespeichert.', 'success');
  } catch (error) {
    setFeedback(error.message, 'error');
  }
});

document.getElementById('saveConfigBtn').addEventListener('click', async () => {
  try {
    await api(`/api/config/${encodeURIComponent(currentConfig)}`, {
      method: 'POST',
      body: JSON.stringify({ content: document.getElementById('configEditor').value })
    });
    setFeedback(`${currentConfig} gespeichert.`, 'success');
  } catch (error) {
    setFeedback(error.message, 'error');
  }
});

for (const button of document.querySelectorAll('[data-config]')) {
  button.addEventListener('click', async () => {
    try {
      await loadConfig(button.dataset.config);
      setFeedback(`${button.dataset.config} geladen.`, 'success');
    } catch (error) {
      setFeedback(error.message, 'error');
    }
  });
}

for (const button of document.querySelectorAll('[data-action]')) {
  button.addEventListener('click', async () => {
    const action = button.dataset.action;
    const dangerous = ['stop', 'restart', 'asa-update', 'panel-update', 'reboot-host'];
    if (dangerous.includes(action) && !confirm(`Aktion ${action} wirklich ausführen?`)) return;

    try {
      if (action === 'backup') {
        await api('/api/backups/create', { method: 'POST', body: JSON.stringify({ type: 'manual' }) });
      } else if (action === 'reboot-host') {
        const delaySeconds = Number(document.getElementById('rebootDelay').value || 0);
        await api(`/api/actions/${action}`, { method: 'POST', body: JSON.stringify({ confirm: true, delaySeconds }) });
      } else {
        const confirmPayload = ['asa-update', 'panel-update'].includes(action) ? { confirm: true } : {};
        await api(`/api/actions/${action}`, { method: 'POST', body: JSON.stringify(confirmPayload) });
      }

      setFeedback(`Aktion '${action}' erfolgreich ausgeführt.`, 'success');
      await refreshDashboard();
    } catch (error) {
      setFeedback(`Aktion '${action}' fehlgeschlagen: ${error.message}`, 'error');
    }
  });
}

bootstrapAuth().catch((error) => {
  console.error(error);
  setFeedback(error.message, 'error');
  show('loginView');
});
