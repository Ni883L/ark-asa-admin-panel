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

const UI = {
  show(viewId) {
    for (const el of document.querySelectorAll('.view')) el.classList.add('hidden');
    document.getElementById(viewId)?.classList.remove('hidden');
  },

  setFeedback(message, type = 'info') {
    const targets = [
      { el: document.getElementById('actionFeedback'), text: document.getElementById('actionFeedbackText') },
      { el: document.getElementById('globalFeedback'), text: document.getElementById('globalFeedbackText') }
    ].filter((entry) => entry.el && entry.text);

    if (!targets.length) return;
    for (const target of targets) {
      if (!message) {
        target.el.className = target.el.id === 'globalFeedback' ? 'feedback hidden global-feedback' : 'feedback hidden';
        target.text.textContent = '';
      } else {
        target.el.className = target.el.id === 'globalFeedback' ? `feedback global-feedback ${type}` : `feedback ${type}`;
        target.text.textContent = message;
      }
    }
  },

  setActionLog(actionLabel, result = {}) {
    const logEl = document.getElementById('actionLog');
    if (!logEl) return;
    const stdout = String(result.stdout || '').trim();
    const stderr = String(result.stderr || '').trim();
    logEl.textContent = [
      `[${new Date().toLocaleString()}] ${actionLabel}`,
      stdout ? `STDOUT:\n${stdout}` : 'STDOUT: (leer)',
      stderr ? `STDERR:\n${stderr}` : 'STDERR: (leer)'
    ].join('\n\n');
  },

  setMainTab(tab) {
    for (const panel of document.querySelectorAll('[data-panel]')) {
      panel.classList.toggle('hidden', panel.dataset.panel !== tab);
    }
    for (const button of document.querySelectorAll('[data-main-tab]')) {
      button.classList.toggle('active', button.dataset.mainTab === tab);
    }
  },

  switchConfigMode(mode) {
    document.getElementById('configModeEditor')?.classList.toggle('hidden', mode !== 'editor');
    document.getElementById('configModeCatalog')?.classList.toggle('hidden', mode !== 'catalog');
    for (const button of document.querySelectorAll('[data-config-mode]')) {
      button.classList.toggle('active', button.dataset.configMode === mode);
    }
  }
};

const Preferences = {
  shouldRequirePassword() {
    return !!document.getElementById('requirePasswordForDangerousActions')?.checked;
  },

  loadDangerousActionPasswordPreference() {
    const value = localStorage.getItem('requirePasswordForDangerousActions');
    const checkbox = document.getElementById('requirePasswordForDangerousActions');
    if (!checkbox) return;
    checkbox.checked = value === '1';
  },

  saveDangerousActionPasswordPreference() {
    const checkbox = document.getElementById('requirePasswordForDangerousActions');
    if (!checkbox) return;
    localStorage.setItem('requirePasswordForDangerousActions', checkbox.checked ? '1' : '0');
  }
};

const Renderers = {
  renderGameSettingsHelp() {
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
        const editor = document.getElementById('configEditor');
        if (!entry || !editor) return;
        if (!editor.value.includes(entry.example)) {
          editor.value = `${editor.value.trimEnd()}\n${entry.example}\n`;
        }
        UI.setFeedback(`${entry.key} eingefügt.`, 'success');
        UI.switchConfigMode('editor');
      });
    }
  },

  renderReadiness(metrics = {}) {
    const target = document.getElementById('serverReadiness');
    if (!target) return;
    const readiness = metrics.readiness;
    if (!readiness || !readiness.label) {
      target.className = 'readiness-banner hidden';
      target.innerHTML = '';
      return;
    }
    target.className = `readiness-banner ${readiness.state || 'unknown'}`;
    target.innerHTML = `${readiness.label}<small>${readiness.detail || ''}</small>`;
  },

  renderStats(status = {}, metrics = {}, versions = {}) {
    const target = document.getElementById('statusGrid');
    if (!target) return;
    const fields = {
      Serverstatus: status.status || metrics.status || 'unknown',
      Profil: status.activeProfile?.name || '-',
      'Spiel-Version': versions?.server?.version || versions?.server?.buildId || '-',
      CPU: metrics.cpu || '-',
      RAM: metrics.memory || '-',
      Disk: metrics.disk || '-',
      Ports: metrics.ports || '-',
      'Letzter Start': metrics.lastStart || '-',
      Karte: metrics.loadedMap || metrics.mapName || '-',
      Crashs: metrics.crashDetected || 'unknown'
    };
    target.innerHTML = Object.entries(fields).map(([k, v]) => `<div class="stat"><strong>${k}</strong><div>${v}</div></div>`).join('');
  },

  renderPlayers(players = []) {
    const target = document.getElementById('players');
    if (!target) return;
    if (!players.length) {
      target.innerHTML = '<div class="summary-item"><strong>Keine Spieler erkannt</strong><div class="hint">Sobald Spieler verbunden sind oder Logs/RCON Daten liefern, erscheinen sie hier.</div></div>';
      return;
    }
    target.innerHTML = `<div class="item-list">${players.map((player) => `<div class="item"><strong>${player.name}</strong><div>ID: ${player.id || '-'}</div><div>Quelle: ${player.source || '-'}</div></div>`).join('')}</div>`;
  },

  renderBackups(backups = []) {
    const target = document.getElementById('backups');
    if (!target) return;
    if (!backups.length) {
      target.innerHTML = '<div class="summary-item"><strong>Keine Backups vorhanden</strong><div class="hint">Erstelle zuerst ein manuelles Backup oder warte auf den nächsten automatischen Lauf.</div></div>';
      return;
    }
    target.innerHTML = `<div class="item-list">${backups.map((backup) => `<div class="item backup-card"><strong>${backup.name}</strong><div class="backup-meta"><div>Geändert: ${backup.modifiedAt}</div><div>Größe: ${backup.size} Bytes</div></div><div class="actions wrap-actions"><button onclick="downloadBackup('${backup.name.replace(/'/g, "\\'")}')">Download</button><button onclick="restoreBackup('${backup.name.replace(/'/g, "\\'")}')">Restore</button></div></div>`).join('')}</div>`;
  },

  renderKeyValueBlock(targetId, value) {
    const target = document.getElementById(targetId);
    if (!target) return;
    if (!value || typeof value !== 'object') {
      target.innerHTML = '<div class="summary-item"><strong>Keine Daten</strong></div>';
      return;
    }

    const formatScalar = (val) => {
      if (val === null || val === undefined || val === '') return '-';
      return typeof val === 'string' ? val : JSON.stringify(val);
    };

    const renderArray = (arr) => {
      if (!arr.length) return '<span class="hint">leer</span>';
      return `<ul class="formatted-list">${arr.map((item) => `<li>${formatScalar(item)}</li>`).join('')}</ul>`;
    };

    const renderNested = (obj) => {
      return `<div class="formatted-nested">${Object.entries(obj)
        .filter(([nestedKey]) => !['source', 'rawVersion'].includes(nestedKey))
        .map(([nestedKey, nestedVal]) => `<div class="formatted-nested-row"><strong>${nestedKey}</strong><span>${Array.isArray(nestedVal) ? `${nestedVal.length} Einträge` : formatScalar(nestedVal)}</span></div>`)
        .join('')}</div>`;
    };

    const entries = Object.entries(value).filter(([key]) => key !== 'source' && key !== 'rawVersion');
    target.innerHTML = entries.map(([key, val]) => {
      const rendered = Array.isArray(val)
        ? renderArray(val)
        : (val && typeof val === 'object')
          ? renderNested(val)
          : `<span>${formatScalar(val)}</span>`;
      return `<div class="formatted-row"><strong>${key}</strong>${rendered}</div>`;
    }).join('');
  },

  renderAuditEntries(entries = []) {
    const target = document.getElementById('auditInfo');
    if (!target) return;
    if (!entries.length) {
      target.innerHTML = '<div class="summary-item"><strong>Keine Audit-Einträge</strong></div>';
      return;
    }

    const prettifyAction = (text) => String(text || '')
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());

    target.innerHTML = entries.map((entry) => {
      const raw = String(entry || '');
      const timestampMatch = raw.match(/^\[(.*?)\]/);
      const actorActionMatch = raw.match(/\]\s+([^\s]+)\s+([^\s]+)(?:\s+(.*))?$/);
      const timestamp = timestampMatch ? timestampMatch[1] : 'Zeit unbekannt';
      const actor = actorActionMatch ? actorActionMatch[1] : 'system';
      const action = actorActionMatch ? prettifyAction(actorActionMatch[2]) : 'Unbekannte Aktion';
      const details = actorActionMatch && actorActionMatch[3] ? actorActionMatch[3] : '';

      return `<div class="audit-entry"><time>${timestamp}</time><strong>${action}</strong><div class="audit-meta">Ausgelöst von: ${actor}</div>${details ? `<div class="audit-details">${details}</div>` : ''}</div>`;
    }).join('');
  },

  renderLogSummary(logText = '') {
    const target = document.getElementById('logsSummary');
    if (!target) return;
    const lines = String(logText || '').split(/\r?\n/).filter(Boolean);
    const lastLine = lines.at(-1) || 'Keine Logs vorhanden';
    const warnings = lines.filter((line) => /warn|warning|fatal|error/i.test(line)).length;
    const items = [
      { title: 'Zeilen', text: String(lines.length) },
      { title: 'Warnungen/Fehler', text: String(warnings) },
      { title: 'Letzte Zeile', text: lastLine.slice(0, 140) }
    ];
    target.innerHTML = items.map((item) => `<div class="summary-item"><strong>${item.title}</strong><div>${item.text}</div></div>`).join('');
  },

  renderOverviewSummary(status = {}, metrics = {}, versions = {}) {
    const target = document.getElementById('overviewSummary');
    if (!target) return;
    const items = [
      { title: 'Server', text: metrics.readiness?.label || status.status || 'Unbekannt' },
      { title: 'Karte', text: metrics.loadedMap || metrics.mapName || 'Noch nicht erkannt' },
      { title: 'Spiel-Version', text: versions?.server?.version || 'Unbekannt' },
      { title: 'Ports', text: metrics.ports || 'unknown' }
    ];
    target.innerHTML = items.map((item) => `<div class="summary-item"><strong>${item.title}</strong><div>${item.text}</div></div>`).join('');
  },

  renderServerSummary(status = {}, metrics = {}, versions = {}) {
    const target = document.getElementById('serverSummary');
    if (!target) return;
    const items = [
      { title: 'Readiness', text: metrics.readiness?.detail || metrics.readiness?.label || 'Unbekannt' },
      { title: 'Version', text: versions?.server?.version || '-' },
      { title: 'Letzter Start', text: metrics.lastStart || '-' },
      { title: 'Ports', text: metrics.ports || '-' },
      { title: 'Karte', text: metrics.loadedMap || metrics.mapName || '-' }
    ];
    target.innerHTML = items.map((item) => `<div class="summary-item"><strong>${item.title}</strong><div>${item.text}</div></div>`).join('');
  },

  renderSystemSummary(panelEnv = {}, panelAutostart = {}, asaAutostart = {}) {
    const target = document.getElementById('systemSummary');
    if (!target) return;
    const items = [
      {
        title: 'Panel-Zugriff',
        text: panelEnv?.lanEnabled ? `LAN aktiv auf Port ${panelEnv.port || 3000}` : `Nur lokal auf ${panelEnv.host || '127.0.0.1'}`
      },
      {
        title: 'HTTPS',
        text: panelEnv?.httpsEnabled ? 'Aktiviert' : 'Deaktiviert'
      },
      {
        title: 'Panel-Autostart',
        text: panelAutostart?.result?.enabled ? 'Aktiv' : 'Nicht aktiv'
      },
      {
        title: 'ASA-Autostart',
        text: asaAutostart?.result?.autoStartEnabled ? 'Aktiv' : 'Nicht aktiv'
      }
    ];
    target.innerHTML = items.map((item) => `<div class="system-badge"><strong>${item.title}</strong><div>${item.text}</div></div>`).join('');
  },

  renderAccessHint(panelEnv = {}) {
    const hint = document.getElementById('accessHint');
    if (!hint || !bootstrapState?.appBinding) return;
    const host = panelEnv.host || bootstrapState.appBinding.host;
    const port = panelEnv.port || bootstrapState.appBinding.port;
    const httpsEnabled = !!panelEnv.httpsEnabled;
    const certReady = !!panelEnv.httpsCertPath && !!panelEnv.httpsKeyPath;
    const scheme = httpsEnabled && certReady ? 'https' : 'http';
    const ips = bootstrapState.localIps || [];
    if (host === '0.0.0.0' || host === '::') {
      if (httpsEnabled && !certReady) {
        hint.textContent = 'HTTPS ist aktiviert, aber Zertifikat/Key fehlen oder sind ungültig — LAN-Zugriff aktuell nur per HTTP erwartbar.';
        return;
      }
      hint.textContent = ips.length ? `LAN-Zugriff aktiv: ${ips.map((ip) => `${scheme}://${ip}:${port}`).join(' | ')}` : `LAN-Zugriff aktiv: ${scheme}://<server-ip>:${port}`;
    } else {
      hint.textContent = `LAN-Zugriff ist aktuell nicht aktiv (HOST=${host}).`;
    }
  }
};

const Api = {
  async request(url, options = {}) {
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
};

const Actions = {
  async withBusy(button, fn) {
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
  },

  async requestSensitivePassword(label) {
    if (!Preferences.shouldRequirePassword()) return '';
    return prompt(`Passwortbestätigung für ${label}:`);
  },

  async restoreBackup(name) {
    if (!confirm(`Backup ${name} wirklich wiederherstellen?`)) return;
    const currentPassword = await Actions.requestSensitivePassword(`Restore ${name}`);
    if (!currentPassword) return;
    try {
      const result = await Api.request('/api/backups/restore', {
        method: 'POST',
        body: JSON.stringify({ name, mode: 'full', confirm: true, currentPassword })
      });
      UI.setActionLog(`Restore ${name}`, result);
      UI.setFeedback(`Backup ${name} wiederhergestellt.`, 'success');
      await App.refreshDashboard();
    } catch (error) {
      UI.setFeedback(error.message, 'error');
    }
  }
};
window.restoreBackup = (name) => Actions.restoreBackup(name);
window.downloadBackup = (name) => {
  window.location.href = `/api/backups/download/${encodeURIComponent(name)}`;
};

const App = {
  async loadConfig(name = currentConfig) {
    currentConfig = name;
    const data = await Api.request(`/api/config/${encodeURIComponent(name)}`);
    const editor = document.getElementById('configEditor');
    if (editor) editor.value = data.content || '';
  },

  renderWizardDetection(result = {}) {
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
  },

  async refreshDashboard() {
    const [dashboardResult, profilesResult, healthResult, versionsResult, tasksResult, usersResult, auditResult, panelEnvResult, panelAutostartResult, asaAutostartResult] = await Promise.allSettled([
      Api.request('/api/dashboard'),
      Api.request('/api/profiles'),
      Api.request('/api/health'),
      Api.request('/api/versions'),
      Api.request('/api/tasks'),
      Api.request('/api/users'),
      Api.request('/api/audit'),
      Api.request('/api/panel-env'),
      Api.request('/api/actions/panel-autostart-status'),
      Api.request('/api/actions/asa-autostart-status')
    ]);

    if (dashboardResult.status === 'fulfilled') {
      const data = dashboardResult.value;
      const versions = versionsResult.status === 'fulfilled' ? versionsResult.value : {};
      Renderers.renderReadiness(data.metrics || {});
      Renderers.renderStats(data.status, data.metrics, versions);
      Renderers.renderOverviewSummary(data.status || {}, data.metrics || {}, versions || {});
      Renderers.renderServerSummary(data.status || {}, data.metrics || {}, versions || {});
      Renderers.renderPlayers(data.players || []);
      Renderers.renderBackups(data.backups || []);
      Renderers.renderLogSummary(data.logs || '');
      document.getElementById('logs').textContent = data.logs || '(leer)';
      document.getElementById('settingsEditor').value = JSON.stringify(data.settings || {}, null, 2);
      document.getElementById('autoAsaUpdateInput').checked = !!data.settings?.autoAsaUpdate;
    } else {
      UI.setFeedback(`Dashboard konnte nicht geladen werden: ${dashboardResult.reason.message}`, 'error');
    }

    if (profilesResult.status === 'fulfilled') document.getElementById('profilesEditor').value = JSON.stringify(profilesResult.value, null, 2);
    if (healthResult.status === 'fulfilled') Renderers.renderKeyValueBlock('healthInfo', healthResult.value);
    if (versionsResult.status === 'fulfilled') Renderers.renderKeyValueBlock('versionInfo', versionsResult.value);
    if (tasksResult.status === 'fulfilled') document.getElementById('tasksEditor').value = JSON.stringify(tasksResult.value.tasks || [], null, 2);
    if (usersResult.status === 'fulfilled') Renderers.renderKeyValueBlock('usersInfo', usersResult.value.users || []);
    if (auditResult.status === 'fulfilled') Renderers.renderAuditEntries(auditResult.value.entries || []);

    if (panelEnvResult.status === 'fulfilled') {
      document.getElementById('panelLanInput').checked = !!panelEnvResult.value.lanEnabled;
      document.getElementById('panelHostInput').value = panelEnvResult.value.host || '127.0.0.1';
      document.getElementById('panelPortInput').value = panelEnvResult.value.port || 3000;
      document.getElementById('panelHttpsInput').checked = !!panelEnvResult.value.httpsEnabled;
      document.getElementById('panelHttpsCertInput').value = panelEnvResult.value.httpsCertPath || '';
      document.getElementById('panelHttpsKeyInput').value = panelEnvResult.value.httpsKeyPath || '';
    }

    if (panelAutostartResult.status === 'fulfilled') document.getElementById('panelAutostartInput').checked = !!panelAutostartResult.value.result?.enabled;
    if (asaAutostartResult.status === 'fulfilled') document.getElementById('asaAutostartInput').checked = !!asaAutostartResult.value.result?.autoStartEnabled;

    Renderers.renderAccessHint(panelEnvResult.status === 'fulfilled' ? panelEnvResult.value : {});
    Renderers.renderSystemSummary(
      panelEnvResult.status === 'fulfilled' ? panelEnvResult.value : {},
      panelAutostartResult.status === 'fulfilled' ? panelAutostartResult.value : {},
      asaAutostartResult.status === 'fulfilled' ? asaAutostartResult.value : {}
    );

    try {
      await App.loadConfig(currentConfig);
    } catch (error) {
      document.getElementById('configEditor').value = `Fehler beim Laden: ${error.message}`;
    }
  },

  async bootstrapAuth() {
    const me = await Api.request('/auth/me');
    if (!me.authenticated) {
      UI.show('loginView');
      return;
    }

    csrfToken = me.csrfToken;
    document.getElementById('welcome').textContent = `Angemeldet als ${me.user.username} (${me.user.role})`;
    bootstrapState = await Api.request('/api/bootstrap');

    if (!bootstrapState.initialized) {
      document.getElementById('wizardAsaPath').value = bootstrapState.defaults?.asaRoot || '';
      document.getElementById('wizardResult').textContent = App.renderWizardDetection(bootstrapState.detection || {});
      UI.show('wizardView');
      return;
    }

    UI.show('dashboardView');
    UI.setMainTab('overview');
    Renderers.renderGameSettingsHelp();
    await App.refreshDashboard();
  },

  bindEvents() {
    document.getElementById('loginForm')?.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        const form = new FormData(event.target);
        const result = await Api.request('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ username: form.get('username'), password: form.get('password') })
        });
        csrfToken = result.user.csrfToken;
        UI.setFeedback('', 'info');
        await App.bootstrapAuth();
      } catch (error) {
        UI.setFeedback(error.message, 'error');
      }
    });

    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
      try {
        await Api.request('/auth/logout', { method: 'POST', body: JSON.stringify({}) });
        csrfToken = null;
        UI.show('loginView');
      } catch (error) {
        UI.setFeedback(error.message, 'error');
      }
    });

    document.getElementById('detectServerBtn')?.addEventListener('click', async () => {
      try {
        const result = await Api.request('/api/detect-server', { method: 'POST', body: JSON.stringify({ path: document.getElementById('wizardAsaPath').value }) });
        document.getElementById('wizardResult').textContent = App.renderWizardDetection(result);
        UI.setFeedback('Servererkennung abgeschlossen.', 'success');
      } catch (error) {
        document.getElementById('wizardResult').textContent = `Servererkennung fehlgeschlagen: ${error.message}`;
        UI.setFeedback(error.message, 'error');
      }
    });

    document.getElementById('completeWizardBtn')?.addEventListener('click', async () => {
      try {
        const result = await Api.request('/api/bootstrap', {
          method: 'POST',
          body: JSON.stringify({ asaRoot: document.getElementById('wizardAsaPath').value, autoBackupBeforeUpdate: true, backupRetention: 14 })
        });
        if (result?.settings?.steamCmdCheck?.ok === false) {
          document.getElementById('wizardResult').textContent = `Einrichtung abgeschlossen, aber SteamCMD-Prüfung fehlgeschlagen:\n${result.settings.steamCmdCheck.message}`;
        }
        await App.bootstrapAuth();
      } catch (error) {
        document.getElementById('wizardResult').textContent = `Einrichtung fehlgeschlagen: ${error.message}`;
        UI.setFeedback(error.message, 'error');
      }
    });

    document.getElementById('refreshBtn')?.addEventListener('click', async () => {
      try {
        await App.refreshDashboard();
        UI.setFeedback('Dashboard aktualisiert.', 'success');
      } catch (error) {
        UI.setFeedback(error.message, 'error');
      }
    });

    document.getElementById('panelLanInput')?.addEventListener('change', (event) => {
      if (event.target.checked) document.getElementById('panelHostInput').value = '0.0.0.0';
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
        await Api.request('/api/profiles', { method: 'POST', body: document.getElementById('profilesEditor').value });
        UI.setFeedback('Profile gespeichert.', 'success');
      } catch (error) {
        UI.setFeedback(error.message, 'error');
      }
    });

    document.getElementById('saveSettingsBtn')?.addEventListener('click', async () => {
      try {
        await Api.request('/api/settings', { method: 'POST', body: document.getElementById('settingsEditor').value });
        UI.setFeedback('Einstellungen gespeichert.', 'success');
      } catch (error) {
        UI.setFeedback(error.message, 'error');
      }
    });

    document.getElementById('savePanelOptionsBtn')?.addEventListener('click', async () => {
      try {
        const lanEnabled = document.getElementById('panelLanInput').checked;
        const host = document.getElementById('panelHostInput').value.trim();
        const port = Number(document.getElementById('panelPortInput').value || 3000);
        const httpsEnabled = document.getElementById('panelHttpsInput').checked;
        const httpsCertPath = document.getElementById('panelHttpsCertInput').value.trim();
        const httpsKeyPath = document.getElementById('panelHttpsKeyInput').value.trim();
        const autoAsaUpdate = document.getElementById('autoAsaUpdateInput').checked;
        await Api.request('/api/panel-env', { method: 'POST', body: JSON.stringify({ host, port, lanEnabled, httpsEnabled, httpsCertPath, httpsKeyPath }) });
        await Api.request('/api/settings', { method: 'POST', body: JSON.stringify({ autoAsaUpdate }) });
        UI.setFeedback(lanEnabled
          ? (httpsEnabled ? 'LAN + HTTPS gespeichert. Zertifikat/Key prüfen und Panel neu starten.' : 'LAN-Zugriff gespeichert. Panel neu starten, dann per http://<server-ip>:PORT erreichbar.')
          : 'Panel-Optionen gespeichert.', 'success');
        await App.refreshDashboard();
      } catch (error) {
        UI.setFeedback(error.message, 'error');
      }
    });

    document.getElementById('restartPanelServiceBtn')?.addEventListener('click', async () => {
      if (!confirm('Panel-Webdienst wirklich neu starten?')) return;
      const currentPassword = await Actions.requestSensitivePassword('Panel-Webdienst-Neustart');
      if (Preferences.shouldRequirePassword() && !currentPassword) return;
      try {
        await Api.request('/api/actions/panel-restart', { method: 'POST', body: JSON.stringify({ currentPassword, requirePassword: Preferences.shouldRequirePassword() }) });
        UI.setFeedback('Webdienst-Neustart ausgelöst. Seite wird neu geladen.', 'info');
        setTimeout(() => window.location.reload(), 4000);
      } catch (error) {
        UI.setFeedback(error.message, 'error');
      }
    });

    document.getElementById('checkFirewallBtn')?.addEventListener('click', async () => {
      try {
        const port = Number(document.getElementById('panelPortInput').value || 3000);
        const data = await Api.request('/api/actions/panel-firewall-check', { method: 'POST', body: JSON.stringify({ port }) });
        UI.setFeedback(data?.result?.isOpen ? `Firewall ist offen für TCP-Port ${port}.` : `Firewall-Regel für TCP-Port ${port} fehlt.`, data?.result?.isOpen ? 'success' : 'error');
      } catch (error) {
        UI.setFeedback(error.message, 'error');
      }
    });

    document.getElementById('openFirewallBtn')?.addEventListener('click', async () => {
      if (!confirm('Firewall-Port jetzt freigeben?')) return;
      const currentPassword = await Actions.requestSensitivePassword('Firewall-Port freigeben');
      if (Preferences.shouldRequirePassword() && !currentPassword) return;
      try {
        const port = Number(document.getElementById('panelPortInput').value || 3000);
        await Api.request('/api/actions/panel-firewall-open', { method: 'POST', body: JSON.stringify({ port, currentPassword, requirePassword: Preferences.shouldRequirePassword() }) });
        UI.setFeedback(`Firewall-Port ${port} freigegeben.`, 'success');
      } catch (error) {
        UI.setFeedback(error.message, 'error');
      }
    });

    document.getElementById('saveAutostartBtn')?.addEventListener('click', async () => {
      const currentPassword = await Actions.requestSensitivePassword('Autostart ändern');
      if (Preferences.shouldRequirePassword() && !currentPassword) return;
      try {
        const enabled = document.getElementById('panelAutostartInput').checked;
        const asaEnabled = document.getElementById('asaAutostartInput').checked;
        try {
          await Api.request('/api/actions/panel-autostart', { method: 'POST', body: JSON.stringify({ enabled, currentPassword, requirePassword: Preferences.shouldRequirePassword() }) });
        } catch (error) {
          if (String(error.message || '').includes('Netzwerkfehler: API nicht erreichbar')) {
            UI.setFeedback('Autostart wird angewendet. Verbindung wird neu aufgebaut...', 'info');
            setTimeout(() => window.location.reload(), 5000);
            return;
          }
          throw error;
        }
        await Api.request('/api/actions/asa-autostart', { method: 'POST', body: JSON.stringify({ enabled: asaEnabled, currentPassword, requirePassword: Preferences.shouldRequirePassword() }) });
        UI.setFeedback('Autostart aktualisiert.', 'success');
        await App.refreshDashboard();
      } catch (error) {
        UI.setFeedback(error.message, 'error');
      }
    });

    document.getElementById('repairPanelServiceBtn')?.addEventListener('click', async () => {
      const currentPassword = await Actions.requestSensitivePassword('Panel-Dienst neu registrieren');
      if (Preferences.shouldRequirePassword() && !currentPassword) return;
      try {
        await Api.request('/api/actions/panel-autostart', { method: 'POST', body: JSON.stringify({ enabled: true, currentPassword, requirePassword: Preferences.shouldRequirePassword() }) });
        UI.setFeedback('Panel-Dienst neu registriert oder Admin-Registrierung angestoßen.', 'success');
        await App.refreshDashboard();
      } catch (error) {
        UI.setFeedback(error.message, 'error');
      }
    });

    document.getElementById('saveTasksBtn')?.addEventListener('click', async () => {
      try {
        await Api.request('/api/tasks', { method: 'POST', body: JSON.stringify({ tasks: JSON.parse(document.getElementById('tasksEditor').value) }) });
        UI.setFeedback('Tasks gespeichert.', 'success');
      } catch (error) {
        UI.setFeedback(error.message, 'error');
      }
    });

    document.getElementById('saveConfigBtn')?.addEventListener('click', async () => {
      try {
        await Api.request(`/api/config/${encodeURIComponent(currentConfig)}`, { method: 'POST', body: JSON.stringify({ content: document.getElementById('configEditor').value }) });
        UI.setFeedback(`${currentConfig} gespeichert.`, 'success');
      } catch (error) {
        UI.setFeedback(error.message, 'error');
      }
    });

    document.getElementById('configEditor')?.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        document.getElementById('saveConfigBtn')?.click();
      }
    });

    document.getElementById('gameSettingsFilter')?.addEventListener('input', Renderers.renderGameSettingsHelp);
    document.getElementById('requirePasswordForDangerousActions')?.addEventListener('change', Preferences.saveDangerousActionPasswordPreference);

    for (const button of document.querySelectorAll('[data-config-mode]')) {
      button.addEventListener('click', () => UI.switchConfigMode(button.dataset.configMode));
    }

    for (const button of document.querySelectorAll('[data-config]')) {
      button.addEventListener('click', async () => {
        try {
          await App.loadConfig(button.dataset.config);
          UI.setFeedback(`${button.dataset.config} geladen.`, 'success');
        } catch (error) {
          UI.setFeedback(error.message, 'error');
        }
      });
    }

    for (const button of document.querySelectorAll('[data-action]')) {
      button.addEventListener('click', async () => {
        const action = button.dataset.action;
        const dangerous = ['stop', 'restart', 'asa-update', 'panel-update', 'reboot-host'];
        if (dangerous.includes(action) && !confirm(`Aktion ${action} wirklich ausführen?`)) return;

        try {
          await Actions.withBusy(button, async () => {
            let result;
            if (action === 'backup') {
              result = await Api.request('/api/backups/create', { method: 'POST', body: JSON.stringify({ type: 'manual' }) });
            } else if (action === 'asa-update-check') {
              result = await Api.request('/api/actions/asa-update-check', { method: 'POST', body: JSON.stringify({}) });
            } else if (action === 'start') {
              try {
                result = await Api.request('/api/actions/start', { method: 'POST', body: JSON.stringify({}) });
              } catch (error) {
                if (String(error.message || '').includes('Netzwerkfehler: API nicht erreichbar')) {
                  UI.setFeedback('Serverstart wurde ausgelöst. Verbindung wird neu aufgebaut...', 'info');
                  setTimeout(() => window.location.reload(), 5000);
                  return;
                }
                throw error;
              }
            } else if (action === 'reboot-host') {
              const currentPassword = await Actions.requestSensitivePassword('Windows-Neustart');
              if (Preferences.shouldRequirePassword() && !currentPassword) return;
              const delaySeconds = Number(document.getElementById('rebootDelay').value || 0);
              result = await Api.request('/api/actions/reboot-host', { method: 'POST', body: JSON.stringify({ confirm: true, delaySeconds, currentPassword, requirePassword: Preferences.shouldRequirePassword() }) });
            } else if (['stop', 'restart', 'asa-update', 'panel-update'].includes(action)) {
              const currentPassword = await Actions.requestSensitivePassword(action);
              if (Preferences.shouldRequirePassword() && !currentPassword) return;
              const payload = ['asa-update', 'panel-update'].includes(action)
                ? { confirm: true, currentPassword, requirePassword: Preferences.shouldRequirePassword() }
                : { currentPassword, requirePassword: Preferences.shouldRequirePassword() };
              if (action === 'panel-update') {
                try {
                  result = await Api.request(`/api/actions/${action}`, { method: 'POST', body: JSON.stringify(payload) });
                } catch (error) {
                  const message = String(error.message || '');
                  if (message.includes('Netzwerkfehler: API nicht erreichbar') || message.includes('Nicht angemeldet')) {
                    UI.setFeedback('Panel-Update läuft. Verbindung wird neu aufgebaut...', 'info');
                    setTimeout(() => window.location.reload(), 5000);
                    return;
                  }
                  throw error;
                }
              } else {
                result = await Api.request(`/api/actions/${action}`, { method: 'POST', body: JSON.stringify(payload) });
              }
            } else {
              result = await Api.request(`/api/actions/${action}`, { method: 'POST', body: JSON.stringify({}) });
            }

            UI.setActionLog(`Aktion ${action}`, result || {});
            if (action === 'panel-update') {
              UI.setFeedback('Panel-Update erfolgreich. Seite wird neu geladen...', 'info');
              setTimeout(() => window.location.reload(), 4000);
            } else {
              UI.setFeedback(`Aktion '${action}' erfolgreich ausgeführt.`, 'success');
              await App.refreshDashboard();
            }
          });
        } catch (error) {
          UI.setActionLog(`Aktion ${action} (Fehler)`, { stderr: error.message });
          if (action === 'asa-update' && String(error.message || '').includes('Stop-Zustand erlaubt')) {
            UI.setFeedback('ASA-Update nur möglich, wenn der Server gestoppt ist. Bitte erst Stop ausführen.', 'error');
          } else {
            UI.setFeedback(`Aktion '${action}' fehlgeschlagen: ${error.message}`, 'error');
          }
        }
      });
    }

    document.getElementById('feedbackCloseBtn')?.addEventListener('click', () => UI.setFeedback('', 'info'));
    document.getElementById('globalFeedbackCloseBtn')?.addEventListener('click', () => UI.setFeedback('', 'info'));

    for (const button of document.querySelectorAll('[data-main-tab]')) {
      button.addEventListener('click', () => UI.setMainTab(button.dataset.mainTab));
    }
  },

  init() {
    App.bindEvents();
    Preferences.loadDangerousActionPasswordPreference();
    Renderers.renderGameSettingsHelp();
    UI.switchConfigMode('editor');
    if (localStorage.getItem('topbarCollapsed') === '1') {
      const topbar = document.querySelector('.topbar');
      if (topbar) {
        topbar.classList.add('collapsed');
        const toggle = document.getElementById('toggleBannerBtn');
        if (toggle) toggle.textContent = 'Banner anzeigen';
      }
    }

    App.bootstrapAuth().catch((error) => {
      console.error(error);
      UI.setFeedback(error.message, 'error');
      UI.show('loginView');
    });
  }
};

App.init();
