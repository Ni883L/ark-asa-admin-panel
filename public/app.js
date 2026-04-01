let csrfToken = null;
let currentConfig = 'GameUserSettings.ini';
let bootstrapState = null;

const gameSettingsCatalog = [
  { ini: 'GameUserSettings.ini', section: '[ServerSettings]', key: 'ServerPassword', description: 'Passwort für normale Spieler beim Join.', example: 'ServerPassword=MeinSicheresPasswort123' },
  { ini: 'GameUserSettings.ini', section: '[ServerSettings]', key: 'ServerAdminPassword', description: 'Adminpasswort für Ingame-Adminbefehle.', example: 'ServerAdminPassword=MeinAdminPasswort123' },
  { ini: 'GameUserSettings.ini', section: '[ServerSettings]', key: 'DifficultyOffset', description: 'Grundschwierigkeit (0.2 bis 1.0), beeinflusst Wild-Dino-Level.', example: 'DifficultyOffset=1.0' },
  { ini: 'GameUserSettings.ini', section: '[ServerSettings]', key: 'XPMultiplier', description: 'XP-Multiplikator für schnelleres/langsameres Leveln.', example: 'XPMultiplier=2.0' },
  { ini: 'Game.ini', section: '[/Script/ShooterGame.ShooterGameMode]', key: 'MatingIntervalMultiplier', description: 'Paarungsintervall (kleiner = öfteres Paaren).', example: 'MatingIntervalMultiplier=0.2' },
  { ini: 'Game.ini', section: '[/Script/ShooterGame.ShooterGameMode]', key: 'EggHatchSpeedMultiplier', description: 'Brutgeschwindigkeit von Eiern (größer = schneller).', example: 'EggHatchSpeedMultiplier=10.0' },
  { ini: 'Game.ini', section: '[/Script/ShooterGame.ShooterGameMode]', key: 'BabyMatureSpeedMultiplier', description: 'Aufzuchtgeschwindigkeit (größer = schneller erwachsen).', example: 'BabyMatureSpeedMultiplier=10.0' },
  { ini: 'GameUserSettings.ini', section: '[ServerSettings]', key: 'HarvestAmountMultiplier', description: 'Ressourcenmenge pro Erntevorgang.', example: 'HarvestAmountMultiplier=2.0' },
  { ini: 'GameUserSettings.ini', section: '[ServerSettings]', key: 'TamingSpeedMultiplier', description: 'Zähmgeschwindigkeit (höher = schneller zähmen).', example: 'TamingSpeedMultiplier=3.0' },
  { ini: 'GameUserSettings.ini', section: '[ServerSettings]', key: 'AllowFlyerCarryPvE', description: 'Flieger dürfen in PvE Kreaturen tragen.', example: 'AllowFlyerCarryPvE=True' },
  { ini: 'GameUserSettings.ini', section: '[ServerSettings]', key: 'ShowMapPlayerLocation', description: 'Spielerposition auf der Map anzeigen.', example: 'ShowMapPlayerLocation=True' },
  { ini: 'Engine.ini', section: '[/Script/Engine.GameSession]', key: 'MaxPlayers', description: 'Maximale Spieleranzahl auf dem Server.', example: 'MaxPlayers=70' }
];

function setFeedback(message, type = 'info') {
  const el = document.getElementById('actionFeedback');
  const textEl = document.getElementById('actionFeedbackText');
  if (!el || !textEl) return;
  if (!message) {
    el.className = 'feedback hidden';
    textEl.textContent = '';
    return;
  }
  el.className = `feedback ${type}`;
  textEl.textContent = message;
}

function setActionLog(actionLabel, result = {}) {
  const logEl = document.getElementById('actionLog');
  if (!logEl) return;
  const stdout = String(result.stdout || '').trim();
  const stderr = String(result.stderr || '').trim();
  logEl.textContent = [
    `[${new Date().toLocaleString()}] ${actionLabel}`,
    stdout ? `STDOUT:\n${stdout}` : 'STDOUT: (leer)',
    stderr ? `STDERR:\n${stderr}` : 'STDERR: (leer)'
  ].join('\n\n');
}

function show(viewId) {
  for (const el of document.querySelectorAll('.view')) el.classList.add('hidden');
  document.getElementById(viewId)?.classList.remove('hidden');
}

function setMainTab(tab) {
  for (const panel of document.querySelectorAll('[data-panel]')) {
    panel.classList.toggle('hidden', panel.dataset.panel !== tab);
  }
  for (const button of document.querySelectorAll('[data-main-tab]')) {
    button.classList.toggle('active', button.dataset.mainTab === tab);
  }
}

function switchConfigMode(mode) {
  document.getElementById('configModeEditor')?.classList.toggle('hidden', mode !== 'editor');
  document.getElementById('configModeCatalog')?.classList.toggle('hidden', mode !== 'catalog');
  for (const button of document.querySelectorAll('[data-config-mode]')) {
    button.classList.toggle('active', button.dataset.configMode === mode);
  }
}

function renderGameSettingsHelp() {
  const target = document.getElementById('gameSettingsHelp');
  if (!target) return;
  const filter = (document.getElementById('gameSettingsFilter')?.value || '').trim().toLowerCase();
  const rows = gameSettingsCatalog
    .map((entry, index) => ({ ...entry, index }))
    .filter((entry) => !filter || `${entry.key} ${entry.description} ${entry.ini} ${entry.section}`.toLowerCase().includes(filter));

  target.innerHTML = rows.map((entry) => `
    <div class="item">
      <strong>${entry.key}</strong>
      <div class="hint">${entry.description}</div>
      <div><code>${entry.ini}</code> · <code>${entry.section}</code></div>
      <div><code>${entry.example}</code></div>
      <button type="button" data-insert-setting="${entry.index}">In Editor einfügen</button>
    </div>
  `).join('');

  for (const button of target.querySelectorAll('[data-insert-setting]')) {
    button.addEventListener('click', () => {
      const entry = gameSettingsCatalog[Number(button.dataset.insertSetting)];
      if (!entry) return;
      const editor = document.getElementById('configEditor');
      if (!editor) return;
      if (!editor.value.includes(entry.example)) {
        editor.value = `${editor.value.trimEnd()}\n${entry.example}\n`;
      }
      setFeedback(`${entry.key} eingefügt.`, 'success');
      switchConfigMode('editor');
    });
  }
}

function renderStats(status = {}, metrics = {}, versions = {}) {
  const target = document.getElementById('statusGrid');
  if (!target) return;
  const fields = {
    Serverstatus: status.status || metrics.status || 'unknown',
    Profil: status.activeProfile?.name || '-',
    'Spiel-Version': versions?.server?.version || '-',
    CPU: metrics.cpu || '-',
    RAM: metrics.memory || '-',
    Disk: metrics.disk || '-',
    Ports: metrics.ports || '-',
    'Letzter Start': metrics.lastStart || '-',
    Crashs: metrics.crashDetected || 'unknown'
  };
  target.innerHTML = Object.entries(fields).map(([k, v]) => `<div class="stat"><strong>${k}</strong><div>${v}</div></div>`).join('');
}

function renderPlayers(players = []) {
  const target = document.getElementById('players');
  if (!target) return;
  if (!players.length) {
    target.innerHTML = '<p>Keine Spieler erkannt.</p>';
    return;
  }
  target.innerHTML = `<div class="item-list">${players.map((player) => `<div class="item"><strong>${player.name}</strong><div>ID: ${player.id || '-'}</div><div>Quelle: ${player.source || '-'}</div></div>`).join('')}</div>`;
}

function renderBackups(backups = []) {
  const target = document.getElementById('backups');
  if (!target) return;
  target.innerHTML = `<div class="item-list">${backups.map((backup) => `<div class="item"><strong>${backup.name}</strong><div>${backup.modifiedAt}</div><div>${backup.size} Bytes</div><button onclick="restoreBackup('${backup.name.replace(/'/g, "\\'")}')">Restore</button></div>`).join('')}</div>`;
}

function renderAccessHint() {
  const hint = document.getElementById('accessHint');
  if (!hint || !bootstrapState?.appBinding) return;
  const { host, port, httpsEnabled } = bootstrapState.appBinding;
  const scheme = httpsEnabled ? 'https' : 'http';
  const ips = bootstrapState.localIps || [];
  if (host === '0.0.0.0' || host === '::') {
    hint.textContent = ips.length ? `LAN-Zugriff aktiv: ${ips.map((ip) => `${scheme}://${ip}:${port}`).join(' | ')}` : `LAN-Zugriff aktiv: ${scheme}://<server-ip>:${port}`;
  } else {
    hint.textContent = `LAN-Zugriff ist aktuell nicht aktiv (HOST=${host}).`;
  }
}

async function api(url, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (csrfToken) headers['x-csrf-token'] = csrfToken;

  let response;
  try {
    response = await fetch(url, { ...options, headers });
  } catch {
    throw new Error('Netzwerkfehler: API nicht erreichbar.');
  }

  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text || 'Unbekannter Fehler' };
  }

  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
}

async function withBusy(button, fn) {
  if (!button) return fn();
  const originalText = button.textContent;
  const progress = document.getElementById('actionProgress');
  button.disabled = true;
  button.textContent = 'Bitte warten...';
  progress?.classList.remove('hidden');
  try {
    return await fn();
  } finally {
    button.disabled = false;
    button.textContent = originalText;
    progress?.classList.add('hidden');
  }
}

function shouldRequirePasswordForDangerousActions() {
  return !!document.getElementById('requirePasswordForDangerousActions')?.checked;
}

function loadDangerousActionPasswordPreference() {
  const value = localStorage.getItem('requirePasswordForDangerousActions');
  const checkbox = document.getElementById('requirePasswordForDangerousActions');
  if (!checkbox) return;
  checkbox.checked = value === '1';
}

function saveDangerousActionPasswordPreference() {
  const checkbox = document.getElementById('requirePasswordForDangerousActions');
  if (!checkbox) return;
  localStorage.setItem('requirePasswordForDangerousActions', checkbox.checked ? '1' : '0');
}

async function requestSensitivePassword(label) {
  if (!shouldRequirePasswordForDangerousActions()) return '';
  return prompt(`Passwortbestätigung für ${label}:`);
}

async function restoreBackup(name) {
  if (!confirm(`Backup ${name} wirklich wiederherstellen?`)) return;
  const currentPassword = await requestSensitivePassword(`Restore ${name}`);
  if (!currentPassword) return;
  try {
    const result = await api('/api/backups/restore', {
      method: 'POST',
      body: JSON.stringify({ name, mode: 'full', confirm: true, currentPassword })
    });
    setActionLog(`Restore ${name}`, result);
    setFeedback(`Backup ${name} wiederhergestellt.`, 'success');
    await refreshDashboard();
  } catch (error) {
    setFeedback(error.message, 'error');
  }
}
window.restoreBackup = restoreBackup;

async function loadConfig(name = currentConfig) {
  currentConfig = name;
  const data = await api(`/api/config/${encodeURIComponent(name)}`);
  const editor = document.getElementById('configEditor');
  if (editor) editor.value = data.content || '';
}

function renderWizardDetection(result = {}) {
  return [
    `ASA-Pfad: ${result.root || '-'}`,
    `Ordner vorhanden: ${result.exists ? 'Ja' : 'Nein'}`,
    `Server-EXE gefunden: ${result.exeExists ? 'Ja' : 'Nein'}`,
    `Config-Verzeichnis gefunden: ${result.configExists ? 'Ja' : 'Nein'}`,
    `Logdatei gefunden: ${result.logExists ? 'Ja' : 'Nein'}`,
    '',
    'Details:',
    JSON.stringify(result, null, 2)
  ].join('\n');
}

async function refreshDashboard() {
  const [dashboardResult, profilesResult, healthResult, versionsResult, tasksResult, usersResult, auditResult, panelEnvResult, panelAutostartResult, asaAutostartResult] = await Promise.allSettled([
    api('/api/dashboard'),
    api('/api/profiles'),
    api('/api/health'),
    api('/api/versions'),
    api('/api/tasks'),
    api('/api/users'),
    api('/api/audit'),
    api('/api/panel-env'),
    api('/api/actions/panel-autostart-status'),
    api('/api/actions/asa-autostart-status')
  ]);

  if (dashboardResult.status === 'fulfilled') {
    const data = dashboardResult.value;
    const versions = versionsResult.status === 'fulfilled' ? versionsResult.value : {};
    renderStats(data.status, data.metrics, versions);
    renderPlayers(data.players || []);
    renderBackups(data.backups || []);
    renderAccessHint();
    document.getElementById('logs').textContent = data.logs || '(leer)';
    document.getElementById('settingsEditor').value = JSON.stringify(data.settings || {}, null, 2);
    document.getElementById('autoAsaUpdateInput').checked = !!data.settings?.autoAsaUpdate;
  } else {
    setFeedback(`Dashboard konnte nicht geladen werden: ${dashboardResult.reason.message}`, 'error');
  }

  if (profilesResult.status === 'fulfilled') document.getElementById('profilesEditor').value = JSON.stringify(profilesResult.value, null, 2);
  if (healthResult.status === 'fulfilled') document.getElementById('healthInfo').textContent = JSON.stringify(healthResult.value, null, 2);
  if (versionsResult.status === 'fulfilled') document.getElementById('versionInfo').textContent = JSON.stringify(versionsResult.value, null, 2);
  if (tasksResult.status === 'fulfilled') document.getElementById('tasksEditor').value = JSON.stringify(tasksResult.value.tasks || [], null, 2);
  if (usersResult.status === 'fulfilled') document.getElementById('usersInfo').textContent = JSON.stringify(usersResult.value.users || [], null, 2);
  if (auditResult.status === 'fulfilled') document.getElementById('auditInfo').textContent = (auditResult.value.entries || []).join('\n');

  if (panelEnvResult.status === 'fulfilled') {
    document.getElementById('panelHostInput').value = panelEnvResult.value.host || '127.0.0.1';
    document.getElementById('panelPortInput').value = panelEnvResult.value.port || 3000;
    document.getElementById('panelHttpsInput').checked = !!panelEnvResult.value.httpsEnabled;
  }

  if (panelAutostartResult.status === 'fulfilled') document.getElementById('panelAutostartInput').checked = !!panelAutostartResult.value.result?.enabled;
  if (asaAutostartResult.status === 'fulfilled') document.getElementById('asaAutostartInput').checked = !!asaAutostartResult.value.result?.autoStartEnabled;

  try {
    await loadConfig(currentConfig);
  } catch (error) {
    document.getElementById('configEditor').value = `Fehler beim Laden: ${error.message}`;
  }
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
    document.getElementById('wizardAsaPath').value = bootstrapState.defaults?.asaRoot || '';
    document.getElementById('wizardResult').textContent = renderWizardDetection(bootstrapState.detection || {});
    show('wizardView');
    return;
  }

  show('dashboardView');
  setMainTab('overview');
  renderGameSettingsHelp();
  await refreshDashboard();
}

function bindEvents() {
  document.getElementById('loginForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const form = new FormData(event.target);
      const result = await api('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: form.get('username'), password: form.get('password') })
      });
      csrfToken = result.user.csrfToken;
      setFeedback('', 'info');
      await bootstrapAuth();
    } catch (error) {
      setFeedback(error.message, 'error');
    }
  });

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    try {
      await api('/auth/logout', { method: 'POST', body: JSON.stringify({}) });
      csrfToken = null;
      show('loginView');
    } catch (error) {
      setFeedback(error.message, 'error');
    }
  });

  document.getElementById('detectServerBtn')?.addEventListener('click', async () => {
    try {
      const result = await api('/api/detect-server', { method: 'POST', body: JSON.stringify({ path: document.getElementById('wizardAsaPath').value }) });
      document.getElementById('wizardResult').textContent = renderWizardDetection(result);
      setFeedback('Servererkennung abgeschlossen.', 'success');
    } catch (error) {
      document.getElementById('wizardResult').textContent = `Servererkennung fehlgeschlagen: ${error.message}`;
      setFeedback(error.message, 'error');
    }
  });

  document.getElementById('completeWizardBtn')?.addEventListener('click', async () => {
    try {
      const result = await api('/api/bootstrap', {
        method: 'POST',
        body: JSON.stringify({ asaRoot: document.getElementById('wizardAsaPath').value, autoBackupBeforeUpdate: true, backupRetention: 14 })
      });
      if (result?.settings?.steamCmdCheck?.ok === false) {
        document.getElementById('wizardResult').textContent = `Einrichtung abgeschlossen, aber SteamCMD-Prüfung fehlgeschlagen:\n${result.settings.steamCmdCheck.message}`;
      }
      await bootstrapAuth();
    } catch (error) {
      document.getElementById('wizardResult').textContent = `Einrichtung fehlgeschlagen: ${error.message}`;
      setFeedback(error.message, 'error');
    }
  });

  document.getElementById('refreshBtn')?.addEventListener('click', async () => {
    try {
      await refreshDashboard();
      setFeedback('Dashboard aktualisiert.', 'success');
    } catch (error) {
      setFeedback(error.message, 'error');
    }
  });

  document.getElementById('toggleBannerBtn')?.addEventListener('click', () => {
    const topbar = document.querySelector('.topbar');
    if (!topbar) return;
    const hidden = topbar.classList.toggle('collapsed');
    localStorage.setItem('topbarCollapsed', hidden ? '1' : '0');
    document.getElementById('toggleBannerBtn').textContent = hidden ? 'Banner anzeigen' : 'Banner ausblenden';
  });

  document.getElementById('saveProfilesBtn')?.addEventListener('click', async () => {
    try {
      await api('/api/profiles', { method: 'POST', body: document.getElementById('profilesEditor').value });
      setFeedback('Profile gespeichert.', 'success');
    } catch (error) {
      setFeedback(error.message, 'error');
    }
  });

  document.getElementById('saveSettingsBtn')?.addEventListener('click', async () => {
    try {
      await api('/api/settings', { method: 'POST', body: document.getElementById('settingsEditor').value });
      setFeedback('Einstellungen gespeichert.', 'success');
    } catch (error) {
      setFeedback(error.message, 'error');
    }
  });

  document.getElementById('savePanelOptionsBtn')?.addEventListener('click', async () => {
    try {
      const host = document.getElementById('panelHostInput').value.trim();
      const port = Number(document.getElementById('panelPortInput').value || 3000);
      const httpsEnabled = document.getElementById('panelHttpsInput').checked;
      const autoAsaUpdate = document.getElementById('autoAsaUpdateInput').checked;
      await api('/api/panel-env', { method: 'POST', body: JSON.stringify({ host, port, httpsEnabled }) });
      await api('/api/settings', { method: 'POST', body: JSON.stringify({ autoAsaUpdate }) });
      setFeedback('Panel-Optionen gespeichert.', 'success');
      await refreshDashboard();
    } catch (error) {
      setFeedback(error.message, 'error');
    }
  });

  document.getElementById('restartPanelServiceBtn')?.addEventListener('click', async () => {
    if (!confirm('Panel-Webdienst wirklich neu starten?')) return;
    const currentPassword = await requestSensitivePassword('Panel-Webdienst-Neustart');
    if (shouldRequirePasswordForDangerousActions() && !currentPassword) return;
    try {
      await api('/api/actions/panel-restart', { method: 'POST', body: JSON.stringify({ currentPassword, requirePassword: shouldRequirePasswordForDangerousActions() }) });
      setFeedback('Webdienst-Neustart ausgelöst. Seite wird neu geladen.', 'info');
      setTimeout(() => window.location.reload(), 4000);
    } catch (error) {
      setFeedback(error.message, 'error');
    }
  });

  document.getElementById('checkFirewallBtn')?.addEventListener('click', async () => {
    try {
      const port = Number(document.getElementById('panelPortInput').value || 3000);
      const data = await api('/api/actions/panel-firewall-check', { method: 'POST', body: JSON.stringify({ port }) });
      setFeedback(data?.result?.isOpen ? `Firewall ist offen für TCP-Port ${port}.` : `Firewall-Regel für TCP-Port ${port} fehlt.`, data?.result?.isOpen ? 'success' : 'error');
    } catch (error) {
      setFeedback(error.message, 'error');
    }
  });

  document.getElementById('openFirewallBtn')?.addEventListener('click', async () => {
    if (!confirm('Firewall-Port jetzt freigeben?')) return;
    const currentPassword = await requestSensitivePassword('Firewall-Port freigeben');
    if (shouldRequirePasswordForDangerousActions() && !currentPassword) return;
    try {
      const port = Number(document.getElementById('panelPortInput').value || 3000);
      await api('/api/actions/panel-firewall-open', { method: 'POST', body: JSON.stringify({ port, currentPassword, requirePassword: shouldRequirePasswordForDangerousActions() }) });
      setFeedback(`Firewall-Port ${port} freigegeben.`, 'success');
    } catch (error) {
      setFeedback(error.message, 'error');
    }
  });

  document.getElementById('saveAutostartBtn')?.addEventListener('click', async () => {
    const currentPassword = await requestSensitivePassword('Autostart ändern');
    if (shouldRequirePasswordForDangerousActions() && !currentPassword) return;
    try {
      const enabled = document.getElementById('panelAutostartInput').checked;
      const asaEnabled = document.getElementById('asaAutostartInput').checked;
      await api('/api/actions/panel-autostart', { method: 'POST', body: JSON.stringify({ enabled, currentPassword, requirePassword: shouldRequirePasswordForDangerousActions() }) });
      await api('/api/actions/asa-autostart', { method: 'POST', body: JSON.stringify({ enabled: asaEnabled, currentPassword, requirePassword: shouldRequirePasswordForDangerousActions() }) });
      setFeedback('Autostart aktualisiert.', 'success');
      await refreshDashboard();
    } catch (error) {
      setFeedback(error.message, 'error');
    }
  });

  document.getElementById('repairPanelServiceBtn')?.addEventListener('click', async () => {
    const currentPassword = await requestSensitivePassword('Panel-Dienst neu registrieren');
    if (shouldRequirePasswordForDangerousActions() && !currentPassword) return;
    try {
      await api('/api/actions/panel-autostart', { method: 'POST', body: JSON.stringify({ enabled: true, currentPassword, requirePassword: shouldRequirePasswordForDangerousActions() }) });
      setFeedback('Panel-Dienst neu registriert.', 'success');
      await refreshDashboard();
    } catch (error) {
      setFeedback(error.message, 'error');
    }
  });

  document.getElementById('saveTasksBtn')?.addEventListener('click', async () => {
    try {
      await api('/api/tasks', { method: 'POST', body: JSON.stringify({ tasks: JSON.parse(document.getElementById('tasksEditor').value) }) });
      setFeedback('Tasks gespeichert.', 'success');
    } catch (error) {
      setFeedback(error.message, 'error');
    }
  });

  document.getElementById('saveConfigBtn')?.addEventListener('click', async () => {
    try {
      await api(`/api/config/${encodeURIComponent(currentConfig)}`, { method: 'POST', body: JSON.stringify({ content: document.getElementById('configEditor').value }) });
      setFeedback(`${currentConfig} gespeichert.`, 'success');
    } catch (error) {
      setFeedback(error.message, 'error');
    }
  });

  document.getElementById('configEditor')?.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      document.getElementById('saveConfigBtn')?.click();
    }
  });

  document.getElementById('gameSettingsFilter')?.addEventListener('input', renderGameSettingsHelp);
  document.getElementById('requirePasswordForDangerousActions')?.addEventListener('change', saveDangerousActionPasswordPreference);

  for (const button of document.querySelectorAll('[data-config-mode]')) {
    button.addEventListener('click', () => switchConfigMode(button.dataset.configMode));
  }

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
        await withBusy(button, async () => {
          let result;
          if (action === 'backup') {
            result = await api('/api/backups/create', { method: 'POST', body: JSON.stringify({ type: 'manual' }) });
          } else if (action === 'asa-update-check') {
            result = await api('/api/actions/asa-update-check', { method: 'POST', body: JSON.stringify({}) });
          } else if (action === 'reboot-host') {
            const currentPassword = await requestSensitivePassword('Windows-Neustart');
            if (shouldRequirePasswordForDangerousActions() && !currentPassword) return;
            const delaySeconds = Number(document.getElementById('rebootDelay').value || 0);
            result = await api('/api/actions/reboot-host', { method: 'POST', body: JSON.stringify({ confirm: true, delaySeconds, currentPassword, requirePassword: shouldRequirePasswordForDangerousActions() }) });
          } else if (['stop', 'restart', 'asa-update', 'panel-update'].includes(action)) {
            const currentPassword = await requestSensitivePassword(action);
            if (shouldRequirePasswordForDangerousActions() && !currentPassword) return;
            const payload = ['asa-update', 'panel-update'].includes(action)
              ? { confirm: true, currentPassword, requirePassword: shouldRequirePasswordForDangerousActions() }
              : { currentPassword, requirePassword: shouldRequirePasswordForDangerousActions() };
            if (action === 'panel-update') {
              try {
                result = await api(`/api/actions/${action}`, { method: 'POST', body: JSON.stringify(payload) });
              } catch (error) {
                if (String(error.message || '').includes('Netzwerkfehler: API nicht erreichbar')) {
                  setFeedback('Panel-Update läuft. Verbindung wird neu aufgebaut...', 'info');
                  setTimeout(() => window.location.reload(), 5000);
                  return;
                }
                throw error;
              }
            } else {
              result = await api(`/api/actions/${action}`, { method: 'POST', body: JSON.stringify(payload) });
            }
          } else {
            result = await api(`/api/actions/${action}`, { method: 'POST', body: JSON.stringify({}) });
          }

          setActionLog(`Aktion ${action}`, result || {});
          if (action === 'panel-update') {
            setFeedback('Panel-Update erfolgreich. Seite wird neu geladen...', 'info');
            setTimeout(() => window.location.reload(), 4000);
          } else {
            setFeedback(`Aktion '${action}' erfolgreich ausgeführt.`, 'success');
            await refreshDashboard();
          }
        });
      } catch (error) {
        setActionLog(`Aktion ${action} (Fehler)`, { stderr: error.message });
        if (action === 'asa-update' && String(error.message || '').includes('Stop-Zustand erlaubt')) {
          setFeedback('ASA-Update nur möglich, wenn der Server gestoppt ist. Bitte erst Stop ausführen.', 'error');
        } else {
          setFeedback(`Aktion '${action}' fehlgeschlagen: ${error.message}`, 'error');
        }
      }
    });
  }

  document.getElementById('feedbackCloseBtn')?.addEventListener('click', () => setFeedback('', 'info'));

  for (const button of document.querySelectorAll('[data-main-tab]')) {
    button.addEventListener('click', () => setMainTab(button.dataset.mainTab));
  }
}

bindEvents();
loadDangerousActionPasswordPreference();
renderGameSettingsHelp();
switchConfigMode('editor');
if (localStorage.getItem('topbarCollapsed') === '1') {
  const topbar = document.querySelector('.topbar');
  if (topbar) {
    topbar.classList.add('collapsed');
    const toggle = document.getElementById('toggleBannerBtn');
    if (toggle) toggle.textContent = 'Banner anzeigen';
  }
}

bootstrapAuth().catch((error) => {
  console.error(error);
  setFeedback(error.message, 'error');
  show('loginView');
});
