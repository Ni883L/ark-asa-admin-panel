let csrfToken = null;
let currentConfig = 'GameUserSettings.ini';
let bootstrapState = null;
const gameSettingsCatalog = [
  {
    ini: 'GameUserSettings.ini',
    section: '[ServerSettings]',
    key: 'ServerPassword',
    description: 'Passwort für normale Spieler beim Join.',
    example: 'ServerPassword=MeinSicheresPasswort123'
  },
  {
    ini: 'GameUserSettings.ini',
    section: '[ServerSettings]',
    key: 'ServerAdminPassword',
    description: 'Adminpasswort für Ingame-Adminbefehle.',
    example: 'ServerAdminPassword=MeinAdminPasswort123'
  },
  {
    ini: 'GameUserSettings.ini',
    section: '[ServerSettings]',
    key: 'DifficultyOffset',
    description: 'Grundschwierigkeit (0.2 bis 1.0), beeinflusst Wild-Dino-Level.',
    example: 'DifficultyOffset=1.0'
  },
  {
    ini: 'GameUserSettings.ini',
    section: '[ServerSettings]',
    key: 'XPMultiplier',
    description: 'XP-Multiplikator für schnelleres/langsameres Leveln.',
    example: 'XPMultiplier=2.0'
  },
  {
    ini: 'Game.ini',
    section: '[/Script/ShooterGame.ShooterGameMode]',
    key: 'MatingIntervalMultiplier',
    description: 'Paarungsintervall (kleiner = öfteres Paaren).',
    example: 'MatingIntervalMultiplier=0.2'
  },
  {
    ini: 'Game.ini',
    section: '[/Script/ShooterGame.ShooterGameMode]',
    key: 'EggHatchSpeedMultiplier',
    description: 'Brutgeschwindigkeit von Eiern (größer = schneller).',
    example: 'EggHatchSpeedMultiplier=10.0'
  },
  {
    ini: 'Game.ini',
    section: '[/Script/ShooterGame.ShooterGameMode]',
    key: 'BabyMatureSpeedMultiplier',
    description: 'Aufzuchtgeschwindigkeit (größer = schneller erwachsen).',
    example: 'BabyMatureSpeedMultiplier=10.0'
  },
  {
    ini: 'GameUserSettings.ini',
    section: '[ServerSettings]',
    key: 'HarvestAmountMultiplier',
    description: 'Ressourcenmenge pro Erntevorgang.',
    example: 'HarvestAmountMultiplier=2.0'
  },
  {
    ini: 'GameUserSettings.ini',
    section: '[ServerSettings]',
    key: 'TamingSpeedMultiplier',
    description: 'Zähmgeschwindigkeit (höher = schneller zähmen).',
    example: 'TamingSpeedMultiplier=3.0'
  },
  {
    ini: 'GameUserSettings.ini',
    section: '[ServerSettings]',
    key: 'AllowFlyerCarryPvE',
    description: 'Flieger dürfen in PvE Kreaturen tragen.',
    example: 'AllowFlyerCarryPvE=True'
  },
  {
    ini: 'GameUserSettings.ini',
    section: '[ServerSettings]',
    key: 'ShowMapPlayerLocation',
    description: 'Spielerposition auf der Map anzeigen.',
    example: 'ShowMapPlayerLocation=True'
  },
  {
    ini: 'Engine.ini',
    section: '[/Script/Engine.GameSession]',
    key: 'MaxPlayers',
    description: 'Maximale Spieleranzahl auf dem Server.',
    example: 'MaxPlayers=70'
  }
];

function setFeedback(message, type = 'info') {
  const el = document.getElementById('actionFeedback');
  if (!el) return;
  const textEl = document.getElementById('actionFeedbackText');
  if (!message) {
    el.className = 'feedback hidden';
    if (textEl) textEl.textContent = '';
    return;
  }

  el.className = `feedback ${type}`;
  if (textEl) {
    textEl.textContent = message;
  } else {
    el.textContent = message;
  }
}


function setActionLog(actionLabel, result) {
  const logEl = document.getElementById('actionLog');
  if (!logEl) return;

  const stdout = String(result?.stdout || '').trim();
  const stderr = String(result?.stderr || '').trim();
  const lines = [
    `[${new Date().toLocaleString()}] ${actionLabel}`,
    stdout ? `STDOUT:\n${stdout}` : 'STDOUT: (leer)',
    stderr ? `STDERR:\n${stderr}` : 'STDERR: (leer)'
  ];
  logEl.textContent = lines.join('\n\n');
}

function renderAccessHint() {
  const hint = document.getElementById('accessHint');
  if (!hint || !bootstrapState?.appBinding) return;

  const { host, port, httpsEnabled } = bootstrapState.appBinding;
  const scheme = httpsEnabled ? 'https' : 'http';
  const ips = bootstrapState.localIps || [];
  if (host === '0.0.0.0' || host === '::') {
    if (ips.length) {
      hint.textContent = `LAN-Zugriff aktiv: ${ips.map((ip) => `${scheme}://${ip}:${port}`).join(' | ')}`;
    } else {
      hint.textContent = `LAN-Zugriff aktiv: ${scheme}://<server-ip>:${port}`;
    }
  } else {
    hint.textContent = `LAN-Zugriff ist aktuell nicht aktiv (HOST=${host}). Für LAN setze HOST=0.0.0.0 und starte den Webdienst neu.`;
  }
}




async function withBusy(button, fn) {
  if (!button) return fn();
  const originalText = button.textContent;
  const progress = document.getElementById('actionProgress');
  button.disabled = true;
  button.textContent = 'Bitte warten...';
  if (progress) progress.classList.remove('hidden');
  try {
    return await fn();
  } finally {
    button.disabled = false;
    button.textContent = originalText;
    if (progress) progress.classList.add('hidden');
  }
}

function renderWizardDetection(result) {
  const lines = [
    `ASA-Pfad: ${result.root}`,
    `Ordner vorhanden: ${result.exists ? 'Ja' : 'Nein'}`,
    `Server-EXE gefunden: ${result.exeExists ? 'Ja' : 'Nein'}`,
    `Config-Verzeichnis gefunden: ${result.configExists ? 'Ja' : 'Nein'}`,
    `Logdatei gefunden: ${result.logExists ? 'Ja' : 'Nein'}`,
    '',
    'Details:',
    JSON.stringify(result, null, 2)
  ];
  return lines.join('\n');
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

function setMainTab(tab) {
  for (const panel of document.querySelectorAll('[data-panel]')) {
    panel.classList.toggle('hidden', panel.dataset.panel !== tab);
  }
  for (const tabButton of document.querySelectorAll('[data-main-tab]')) {
    tabButton.classList.toggle('active', tabButton.dataset.mainTab === tab);
  }
}

function renderGameSettingsHelp() {
  const target = document.getElementById('gameSettingsHelp');
  if (!target) return;
  const filter = (document.getElementById('gameSettingsFilter')?.value || '').trim().toLowerCase();
  const rows = gameSettingsCatalog
    .map((entry, index) => ({ ...entry, index }))
    .filter((entry) => {
      if (!filter) return true;
      return `${entry.key} ${entry.description} ${entry.ini} ${entry.section}`.toLowerCase().includes(filter);
    });
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
      if (currentConfig !== entry.ini) {
        setFeedback(`Hinweis: ${entry.key} gehört zu ${entry.ini}.`, 'info');
      }
      const editor = document.getElementById('configEditor');
      const content = editor.value || '';
      const line = `${entry.example}`;
      if (content.includes(line)) {
        setFeedback(`${entry.key} ist bereits im Editor vorhanden.`, 'info');
        return;
      }
      editor.value = `${content.trimEnd()}\n${line}\n`;
      setFeedback(`${entry.key} als Beispiel in den Editor eingefügt.`, 'success');
      switchConfigMode('editor');
    });
  }
}

function switchConfigMode(mode) {
  const editorPanel = document.getElementById('configModeEditor');
  const catalogPanel = document.getElementById('configModeCatalog');
  if (!editorPanel || !catalogPanel) return;
  const editorActive = mode === 'editor';
  editorPanel.classList.toggle('hidden', !editorActive);
  catalogPanel.classList.toggle('hidden', editorActive);
  for (const button of document.querySelectorAll('[data-config-mode]')) {
    button.classList.toggle('active', button.dataset.configMode === mode);
  }
}

function renderStats(status, metrics, versions) {
  const target = document.getElementById('statusGrid');
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
  const [data, profiles, health, versions, tasks, users, audit, panelEnv, autostart, asaAutostart] = await Promise.all([
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

  renderStats(data.status, data.metrics, versions);
  renderPlayers(data.players);
  renderBackups(data.backups);
  renderAccessHint();
  document.getElementById('logs').textContent = data.logs || '(leer)';
  document.getElementById('profilesEditor').value = JSON.stringify(profiles, null, 2);
  document.getElementById('settingsEditor').value = JSON.stringify(data.settings, null, 2);
  document.getElementById('panelHostInput').value = panelEnv.host || '127.0.0.1';
  document.getElementById('panelPortInput').value = panelEnv.port || 3000;
  document.getElementById('panelHttpsInput').checked = !!panelEnv.httpsEnabled;
  document.getElementById('autoAsaUpdateInput').checked = !!data.settings.autoAsaUpdate;
  document.getElementById('panelAutostartInput').checked = !!autostart?.result?.enabled;
  document.getElementById('asaAutostartInput').checked = !!asaAutostart?.result?.autoStartEnabled;
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
    document.getElementById('wizardResult').textContent = renderWizardDetection(bootstrapState.detection);
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
    document.getElementById('wizardResult').textContent = renderWizardDetection(result);
    setFeedback('Servererkennung abgeschlossen. Prüfe die Details im Feld darunter.', 'info');
  } catch (error) {
    document.getElementById('wizardResult').textContent = `Servererkennung fehlgeschlagen: ${error.message}`;
    setFeedback(error.message, 'error');
  }
});

document.getElementById('completeWizardBtn').addEventListener('click', async () => {
  try {
    const result = await api('/api/bootstrap', {
      method: 'POST',
      body: JSON.stringify({
        asaRoot: document.getElementById('wizardAsaPath').value,
        autoBackupBeforeUpdate: true,
        backupRetention: 14
      })
    });

    if (result?.settings?.steamCmdCheck?.ok === false) {
      document.getElementById('wizardResult').textContent = `Einrichtung abgeschlossen, aber SteamCMD-Prüfung fehlgeschlagen:
${result.settings.steamCmdCheck.message}`;
      setFeedback('SteamCMD konnte bei der Einrichtung nicht vorbereitet werden. Details siehe unten.', 'error');
    } else {
      const panelFileCheck = result?.settings?.panelFileCheck;
      if (panelFileCheck && panelFileCheck.ok === false) {
        const missing = (panelFileCheck.checks || []).filter((item) => !item.exists).map((item) => item.path);
        document.getElementById('wizardResult').textContent = `Einrichtung abgeschlossen, aber Panel-Datei-Check meldet fehlende Dateien:
${missing.join('\n') || '(unbekannt)'}`;
        setFeedback('SteamCMD ist bereit, aber der Panel-Datei-Check meldet fehlende Dateien. Details siehe unten.', 'error');
      } else {
        setFeedback('Einrichtung abgeschlossen. SteamCMD und Panel-Datei-Check sind erfolgreich.', 'success');
      }
    }

    await bootstrapAuth();
  } catch (error) {
    document.getElementById('wizardResult').textContent = `Einrichtung fehlgeschlagen: ${error.message}`;
    setFeedback(error.message, 'error');
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

document.getElementById('toggleBannerBtn')?.addEventListener('click', () => {
  const topbar = document.querySelector('.topbar');
  if (!topbar) return;
  const hidden = topbar.classList.toggle('collapsed');
  localStorage.setItem('topbarCollapsed', hidden ? '1' : '0');
  document.getElementById('toggleBannerBtn').textContent = hidden ? 'Banner anzeigen' : 'Banner ausblenden';
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

document.getElementById('savePanelOptionsBtn').addEventListener('click', async () => {
  try {
    const host = document.getElementById('panelHostInput').value.trim();
    const port = Number(document.getElementById('panelPortInput').value || 3000);
    const httpsEnabled = document.getElementById('panelHttpsInput').checked;
    const autoAsaUpdate = document.getElementById('autoAsaUpdateInput').checked;

    await api('/api/panel-env', {
      method: 'POST',
      body: JSON.stringify({ host, port, httpsEnabled })
    });
    await api('/api/settings', {
      method: 'POST',
      body: JSON.stringify({ autoAsaUpdate })
    });
    setFeedback('Panel-Optionen gespeichert. Für HOST/PORT/HTTPS ist ein Webdienst-Neustart erforderlich.', 'success');
    await refreshDashboard();
  } catch (error) {
    setFeedback(error.message, 'error');
  }
});

document.getElementById('restartPanelServiceBtn').addEventListener('click', async () => {
  if (!confirm('Panel-Webdienst wirklich neu starten? Die aktuelle Verbindung wird getrennt.')) return;
  try {
    await api('/api/actions/panel-restart', { method: 'POST', body: JSON.stringify({ confirm: true }) });
  } catch (error) {
    setFeedback(`Neustart fehlgeschlagen: ${error.message}`, 'error');
    return;
  }
  setFeedback('Webdienst-Neustart wurde ausgelöst. Seite in wenigen Sekunden neu laden.', 'info');
  setTimeout(() => window.location.reload(), 4000);
});

document.getElementById('checkFirewallBtn').addEventListener('click', async () => {
  try {
    const port = Number(document.getElementById('panelPortInput').value || 3000);
    const data = await api('/api/actions/panel-firewall-check', { method: 'POST', body: JSON.stringify({ port }) });
    if (data?.result?.isOpen) {
      setFeedback(`Firewall ist bereits offen für TCP-Port ${port}.`, 'success');
    } else {
      setFeedback(`Firewall-Regel für TCP-Port ${port} fehlt. Bitte Port freigeben.`, 'error');
    }
  } catch (error) {
    if (error.message.includes('404')) {
      setFeedback('Firewall-API nicht gefunden (404). Bitte zuerst Panel-Update ausführen und danach den Webdienst neu starten.', 'error');
      return;
    }
    setFeedback(`Firewall-Check fehlgeschlagen: ${error.message}`, 'error');
  }
});

document.getElementById('openFirewallBtn').addEventListener('click', async () => {
  if (!confirm('Firewall-Port für das Panel jetzt freigeben? (Administratorrechte nötig)')) return;
  try {
    const port = Number(document.getElementById('panelPortInput').value || 3000);
    await api('/api/actions/panel-firewall-open', { method: 'POST', body: JSON.stringify({ port }) });
    setFeedback(`Firewall-Port ${port} wurde freigegeben (oder war bereits offen).`, 'success');
  } catch (error) {
    if (error.message.includes('404')) {
      setFeedback('Firewall-API nicht gefunden (404). Bitte zuerst Panel-Update ausführen und danach den Webdienst neu starten.', 'error');
      return;
    }
    setFeedback(`Firewall-Freigabe fehlgeschlagen: ${error.message}`, 'error');
  }
});

document.getElementById('saveAutostartBtn').addEventListener('click', async () => {
  const enabled = document.getElementById('panelAutostartInput').checked;
  const asaEnabled = document.getElementById('asaAutostartInput').checked;
  try {
    await api('/api/actions/panel-autostart', {
      method: 'POST',
      body: JSON.stringify({ enabled })
    });
    await api('/api/actions/asa-autostart', {
      method: 'POST',
      body: JSON.stringify({ enabled: asaEnabled })
    });
    setFeedback(enabled ? 'Autostart-Dienst wurde installiert/aktiviert.' : 'Autostart-Dienst wurde deaktiviert/entfernt.', 'success');
    await refreshDashboard();
  } catch (error) {
    setFeedback(`Autostart konnte nicht geändert werden: ${error.message}`, 'error');
  }
});

document.getElementById('repairPanelServiceBtn')?.addEventListener('click', async () => {
  try {
    await api('/api/actions/panel-autostart', {
      method: 'POST',
      body: JSON.stringify({ enabled: true })
    });
    setFeedback('Panel-Dienst wurde neu registriert (Autostart aktiv).', 'success');
    await refreshDashboard();
  } catch (error) {
    setFeedback(`Panel-Dienst Registrierung fehlgeschlagen: ${error.message}`, 'error');
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

document.getElementById('configEditor')?.addEventListener('keydown', async (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault();
    document.getElementById('saveConfigBtn').click();
  }
});

for (const button of document.querySelectorAll('[data-config-mode]')) {
  button.addEventListener('click', () => switchConfigMode(button.dataset.configMode));
}
document.getElementById('gameSettingsFilter')?.addEventListener('input', () => renderGameSettingsHelp());

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
      if (action === 'backup') {
        const result = await api('/api/backups/create', { method: 'POST', body: JSON.stringify({ type: 'manual' }) });
        setActionLog('Backup', result);
        setFeedback(`Aktion '${action}' erfolgreich ausgeführt.`, 'success');
      } else if (action === 'reboot-host') {
        const delaySeconds = Number(document.getElementById('rebootDelay').value || 0);
        const result = await api(`/api/actions/${action}`, { method: 'POST', body: JSON.stringify({ confirm: true, delaySeconds }) });
        setActionLog('Host-Reboot', result);
        setFeedback(`Aktion '${action}' erfolgreich ausgeführt.`, 'success');
      } else if (action === 'asa-update-check') {
        const result = await api('/api/actions/asa-update-check', { method: 'POST', body: JSON.stringify({}) });
        setActionLog('ASA-Update prüfen', result);
        if (result?.check?.updateAvailable) {
          const autoUpdated = result.autoUpdated ? ' Auto-Update wurde ausgeführt.' : '';
          setFeedback(`ASA-Update verfügbar (Installiert: ${result.check.installedBuild || 'unbekannt'}, Neu: ${result.check.latestBuild || 'unbekannt'}).${autoUpdated}`, result.autoUpdated ? 'success' : 'info');
        } else {
          setFeedback(`ASA ist aktuell (Build: ${result?.check?.installedBuild || 'unbekannt'}).`, 'success');
        }
      } else {
        const confirmPayload = ['asa-update', 'panel-update'].includes(action) ? { confirm: true } : {};
        const result = await api(`/api/actions/${action}`, { method: 'POST', body: JSON.stringify(confirmPayload) });
        setActionLog(`Aktion ${action}`, result);
        if (action === 'panel-update') {
          setFeedback("Panel-Update erfolgreich. Webdienst wird neu gestartet...", 'info');
          setTimeout(async () => {
            try {
              await api('/api/actions/panel-restart', { method: 'POST', body: JSON.stringify({ confirm: true }) });
            } catch (_error) {
              // no-op; page reload below will still happen
            }
            window.location.reload();
          }, 1200);
        } else {
          setFeedback(`Aktion '${action}' erfolgreich ausgeführt.`, 'success');
        }
      }

      await refreshDashboard();
      });
    } catch (error) {
      setActionLog(`Aktion ${action} (Fehler)`, { stderr: error.message });
      setFeedback(`Aktion '${action}' fehlgeschlagen: ${error.message}`, 'error');
    }
  });
}

document.getElementById('feedbackCloseBtn')?.addEventListener('click', () => setFeedback('', 'info'));

for (const button of document.querySelectorAll('[data-main-tab]')) {
  button.addEventListener('click', () => setMainTab(button.dataset.mainTab));
}
setMainTab('overview');
renderGameSettingsHelp();

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
