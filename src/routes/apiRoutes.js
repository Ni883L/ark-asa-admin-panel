const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
const defaults = require('../config/defaults');
const authService = require('../services/authService');
const store = require('../services/store');
const asaService = require('../services/asaService');
const backupService = require('../services/backupService');
const monitorService = require('../services/monitorService');
const webhookService = require('../services/webhookService');
const logger = require('../services/logger');
const setupService = require('../services/setupService');
const schedulerService = require('../services/schedulerService');
const schedulerRunnerService = require('../services/schedulerRunnerService');
const healthService = require('../services/healthService');
const versionService = require('../services/versionService');
const rollbackService = require('../services/rollbackService');
const auditService = require('../services/auditService');
const userAdminService = require('../services/userAdminService');

const router = express.Router();
const envFilePath = path.resolve(process.cwd(), '.env');

function readPanelEnv() {
  const map = {};
  if (!fs.existsSync(envFilePath)) return map;
  for (const line of fs.readFileSync(envFilePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#') || !line.includes('=')) continue;
    const [k, ...rest] = line.split('=');
    map[k.trim()] = rest.join('=').trim();
  }
  return map;
}

function writePanelEnv(updates = {}) {
  const existing = readPanelEnv();
  const merged = { ...existing, ...updates };
  const order = ['HOST', 'PORT', 'HTTPS_ENABLED'];
  const keys = Array.from(new Set([...order, ...Object.keys(merged)]));
  const content = keys
    .filter((key) => merged[key] !== undefined && merged[key] !== null && String(merged[key]).length > 0)
    .map((key) => `${key}=${merged[key]}`)
    .join('\n');
  fs.writeFileSync(envFilePath, `${content}\n`, 'utf8');
  return merged;
}

router.use((req, res, next) => {
  try {
    authService.requireAuth(req);
    next();
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

router.get('/bootstrap', (_req, res) => {
  const wizard = setupService.getWizardState();
  const localIps = Object.values(os.networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address);
  res.json({
    ...wizard,
    appName: defaults.app.name,
    host: os.hostname(),
    version: require('../../package.json').version,
    appBinding: {
      host: defaults.app.host,
      port: defaults.app.port,
      httpsEnabled: defaults.app.httpsEnabled
    },
    localIps
  });
});

router.post('/bootstrap', async (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    const settings = await setupService.completeWizard(req.body || {});
    res.json({ ok: true, settings });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/dashboard', async (_req, res) => {
  try {
    const [status, metrics] = await Promise.all([asaService.getStatus(), monitorService.getMetrics()]);
    res.json({
      status,
      metrics,
      players: monitorService.parsePlayers(),
      logs: monitorService.getRecentLogs(150),
      backups: backupService.listBackups().slice(0, 10),
      settings: store.getSettings()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/profiles', (_req, res) => res.json(asaService.getProfileSummary()));
router.post('/profiles', (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    res.json(asaService.saveProfiles(req.body));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/config/:name', (req, res) => {
  try {
    const allowed = ['GameUserSettings.ini', 'Game.ini', 'Engine.ini'];
    if (!allowed.includes(req.params.name)) throw new Error('Datei nicht erlaubt.');
    res.json(asaService.readIni(req.params.name));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/config/:name', (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    const allowed = ['GameUserSettings.ini', 'Game.ini', 'Engine.ini'];
    if (!allowed.includes(req.params.name)) throw new Error('Datei nicht erlaubt.');
    res.json(asaService.writeIni(req.params.name, String(req.body.content || '')));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/detect-server', (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    res.json(setupService.detectServerRoot(req.body.path));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/actions/start', async (_req, res) => {
  try {
    authService.requireRole(_req, ['admin']);
    const result = await asaService.startServer();
    await webhookService.notify('ASA gestartet', 'Der ARK-Server wurde über das Webpanel gestartet.');
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post('/actions/stop', async (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    const result = await asaService.stopServer();
    await webhookService.notify('ASA gestoppt', 'Der ARK-Server wurde über das Webpanel gestoppt.');
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post('/actions/restart', async (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    const result = await asaService.restartServer();
    await webhookService.notify('ASA neugestartet', 'Der ARK-Server wurde über das Webpanel neugestartet.');
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post('/actions/reboot-host', async (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    const result = await asaService.rebootHost(req.body || {});
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post('/actions/panel-update', async (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    const result = await asaService.selfUpdate();
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post('/actions/panel-restart', async (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    const result = await asaService.restartPanelService();
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post('/actions/panel-firewall-check', async (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    const port = Number(req.body?.port || defaults.app.port || 3000);
    res.json({ ok: true, result: await asaService.checkPanelFirewall(port) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post('/actions/panel-firewall-open', async (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    const port = Number(req.body?.port || defaults.app.port || 3000);
    res.json({ ok: true, result: await asaService.openPanelFirewall(port) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.get('/actions/panel-autostart-status', async (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    res.json({ ok: true, result: await asaService.getPanelAutostartStatus() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post('/actions/panel-autostart', async (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    const enabled = !!req.body?.enabled;
    res.json({ ok: true, result: await asaService.setPanelAutostart(enabled) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.get('/actions/asa-autostart-status', async (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    res.json({ ok: true, result: await asaService.getAsaAutostartStatus() });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post('/actions/asa-autostart', async (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    const enabled = !!req.body?.enabled;
    res.json({ ok: true, result: await asaService.setAsaAutostart(enabled) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/actions/asa-update-check', async (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    const check = await asaService.checkForServerUpdate();
    let autoUpdated = false;
    if (check.updateAvailable && store.getSettings().autoAsaUpdate === true) {
      await asaService.installOrUpdateServer();
      autoUpdated = true;
    }
    res.json({ ok: true, check, autoUpdated });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/actions/asa-update', async (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    const result = await asaService.installOrUpdateServer();
    await webhookService.notify('ASA-Update', 'Serverdateien wurden installiert/aktualisiert.');
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/backups', (_req, res) => res.json({ backups: backupService.listBackups() }));
router.post('/backups/create', async (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    const result = await backupService.createBackup(req.body.type || 'manual');
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post('/backups/restore', async (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    const result = await backupService.restoreBackup(req.body.name, req.body.mode || 'full');
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.post('/backups/validate', async (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    const result = await backupService.validateBackup(req.body.name);
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/logs', (req, res) => {
  res.json({ log: monitorService.getRecentLogs(Number(req.query.lines || 200)) });
});
router.get('/players', (_req, res) => res.json({ players: monitorService.parsePlayers() }));
router.get('/settings', (_req, res) => res.json(store.getSettings()));
router.post('/settings', (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    const settings = { ...store.getSettings(), ...req.body };
    store.saveSettings(settings);
    res.json({ ok: true, settings });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
router.get('/panel-env', (_req, res) => {
  const env = readPanelEnv();
  res.json({
    host: env.HOST || defaults.app.host,
    port: Number(env.PORT || defaults.app.port),
    httpsEnabled: ['1', 'true', 'yes', 'on'].includes(String(env.HTTPS_ENABLED || defaults.app.httpsEnabled).toLowerCase())
  });
});
router.post('/panel-env', (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    const host = String(req.body.host || '127.0.0.1').trim();
    const port = Number(req.body.port || 3000);
    const httpsEnabled = !!req.body.httpsEnabled;
    if (!host) throw new Error('HOST darf nicht leer sein.');
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT muss zwischen 1 und 65535 liegen.');
    writePanelEnv({
      HOST: host,
      PORT: String(port),
      HTTPS_ENABLED: httpsEnabled ? 'true' : 'false'
    });
    res.json({ ok: true, message: 'Panel-Variablen gespeichert. Neustart erforderlich.' });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/tasks', (_req, res) => res.json({ tasks: schedulerService.listTasks() }));
router.get('/tasks/runtime', (_req, res) => res.json({ tasks: schedulerRunnerService.listRuntime() }));
router.post('/tasks', (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    res.json({ ok: true, tasks: schedulerService.saveTasks(req.body.tasks || []) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
router.post('/tasks/:id/run', async (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    res.json(await schedulerRunnerService.runTaskNow(req.params.id));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/versions', (_req, res) => res.json({ ...versionService.getUpdateInfo(), panelBackups: rollbackService.listPanelBackups() }));
router.get('/audit', (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    res.json({ entries: auditService.listAuditLines(Number(req.query.limit || 200)) });
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});
router.get('/users', (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    res.json({ users: userAdminService.listUsers() });
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
});
router.post('/users', (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    res.json({ ok: true, user: userAdminService.createUser(req.body || {}) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
router.post('/users/:username', (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    res.json({ ok: true, user: userAdminService.updateUser(req.params.username, req.body || {}) });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
router.delete('/users/:username', (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    res.json(userAdminService.deleteUser(req.params.username));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
router.get('/health', async (_req, res) => {
  try {
    res.json(await healthService.getHealth());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
router.use((error, _req, res, _next) => {
  logger.error('API failure', { error: error.message });
  res.status(500).json({ error: 'Interner Serverfehler.' });
});

module.exports = router;
