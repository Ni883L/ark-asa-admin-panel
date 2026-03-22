let csrfToken = null;
let currentConfig = 'GameUserSettings.ini';

async function api(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (csrfToken) headers['x-csrf-token'] = csrfToken;
  const response = await fetch(url, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Fehler');
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
    Letzter Start: metrics.lastStart || '-',
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
  await api('/api/backups/restore', { method: 'POST', body: JSON.stringify({ name, mode: 'full' }) });
  await refreshDashboard();
}
window.restoreBackup = restoreBackup;

async function loadConfig(name = currentConfig) {
  currentConfig = name;
  const data = await api(`/api/config/${encodeURIComponent(name)}`);
  document.getElementById('configEditor').value = data.content || '';
}

async function refreshDashboard() {
  const data = await api('/api/dashboard');
  renderStats(data.status, data.metrics);
  renderPlayers(data.players);
  renderBackups(data.backups);
  document.getElementById('logs').textContent = data.logs || '(leer)';
  document.getElementById('profilesEditor').value = JSON.stringify(await api('/api/profiles'), null, 2);
  document.getElementById('settingsEditor').value = JSON.stringify(data.settings, null, 2);
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
  show('dashboardView');
  await refreshDashboard();
}

document.getElementById('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = new FormData(event.target);
  const result = await api('/auth/login', { method: 'POST', body: JSON.stringify({ username: form.get('username'), password: form.get('password') }) });
  csrfToken = result.user.csrfToken;
  await bootstrapAuth();
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await api('/auth/logout', { method: 'POST', body: JSON.stringify({}) });
  csrfToken = null;
  show('loginView');
});

document.getElementById('detectServerBtn').addEventListener('click', async () => {
  const result = await api('/api/detect-server', { method: 'POST', body: JSON.stringify({ path: document.getElementById('wizardAsaPath').value }) });
  document.getElementById('wizardResult').textContent = JSON.stringify(result, null, 2);
});
document.getElementById('completeWizardBtn').addEventListener('click', async () => {
  await api('/api/bootstrap', { method: 'POST', body: JSON.stringify({ asaRoot: document.getElementById('wizardAsaPath').value, autoBackupBeforeUpdate: true, backupRetention: 14 }) });
  await bootstrapAuth();
});
document.getElementById('refreshBtn').addEventListener('click', refreshDashboard);
document.getElementById('saveProfilesBtn').addEventListener('click', async () => {
  await api('/api/profiles', { method: 'POST', body: document.getElementById('profilesEditor').value });
  alert('Profile gespeichert.');
});
document.getElementById('saveSettingsBtn').addEventListener('click', async () => {
  await api('/api/settings', { method: 'POST', body: document.getElementById('settingsEditor').value });
  alert('Einstellungen gespeichert.');
});
document.getElementById('saveTasksBtn').addEventListener('click', async () => {
  await api('/api/tasks', { method: 'POST', body: JSON.stringify({ tasks: JSON.parse(document.getElementById('tasksEditor').value) }) });
  alert('Tasks gespeichert.');
});
document.getElementById('saveConfigBtn').addEventListener('click', async () => {
  await api(`/api/config/${encodeURIComponent(currentConfig)}`, { method: 'POST', body: JSON.stringify({ content: document.getElementById('configEditor').value }) });
  alert('Config gespeichert.');
});
for (const button of document.querySelectorAll('[data-config]')) {
  button.addEventListener('click', () => loadConfig(button.dataset.config));
}
for (const button of document.querySelectorAll('[data-action]')) {
  button.addEventListener('click', async () => {
    const action = button.dataset.action;
    const dangerous = ['stop', 'restart', 'asa-update', 'panel-update', 'reboot-host'];
    if (dangerous.includes(action) && !confirm(`Aktion ${action} wirklich ausführen?`)) return;
    if (action === 'backup') {
      await api('/api/backups/create', { method: 'POST', body: JSON.stringify({ type: 'manual' }) });
    } else {
      await api(`/api/actions/${action}`, { method: 'POST', body: JSON.stringify({}) });
    }
    await refreshDashboard();
  });
}

bootstrapAuth().catch((error) => {
  console.error(error);
  show('loginView');
});
body: JSON.stringify({}) });
    }
    await refreshDashboard();
  });
}

bootstrapAuth().catch((error) => {
  console.error(error);
  show('loginView');
});
