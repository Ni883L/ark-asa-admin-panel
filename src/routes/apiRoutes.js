const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
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
const actionPolicyService = require('../services/actionPolicyService');
const { sendError } = require('../util/http');
const { ValidationError } = require('../util/errors');

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
  const order = ['HOST', 'PORT', 'HTTPS_ENABLED', 'HTTPS_CERT_PATH', 'HTTPS_KEY_PATH', 'ASA_SERVER_SERVICE_NAME'];
  const keys = Array.from(new Set([...order, ...Object.keys(merged)]));
  const content = keys
    .filter((key) => merged[key] !== undefined && merged[key] !== null && String(merged[key]).length > 0)
    .map((key) => `${key}=${merged[key]}`)
    .join('\n');
  fs.writeFileSync(envFilePath, `${content}\n`, 'utf8');
  return merged;
}

function handleRoute(handler) {
  return async (req, res) => {
    try {
      await handler(req, res);
    } catch (error) {
      sendError(res, error, 500);
    }
  };
}

function requireSensitiveActionAuth(req) {
  return actionPolicyService.requireRecentAuth(req, req.body || {});
}

router.use((req, res, next) => {
  try {
    authService.requireAuth(req);
    next();
  } catch (error) {
    sendError(res, error, 401);
  }
});

router.get('/bootstrap', handleRoute(async (_req, res) => {
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
}));

router.post('/bootstrap', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  const settings = await setupService.completeWizard(req.body || {});
  res.json({ ok: true, settings });
}));

router.get('/dashboard', handleRoute(async (_req, res) => {
  const [status, metrics] = await Promise.all([asaService.getStatus(), monitorService.getMetrics()]);
  metrics.configuredPorts = status.configuredPorts || metrics.configuredPorts || 'unknown';
  metrics.configuredPortsRaw = status.configuredPortsRaw || metrics.configuredPortsRaw || '';
  metrics.displayPorts = metrics.ports || metrics.displayPorts || status.configuredPorts || 'unknown';
  res.json({
    status,
    metrics,
    players: monitorService.parsePlayers(),
    logs: monitorService.getRecentLogs(150),
    backups: backupService.listBackups().slice(0, 10),
    settings: store.getSettings()
  });
}));

router.get('/profiles', handleRoute(async (_req, res) => {
  res.json(asaService.getProfileSummary());
}));

router.post('/profiles', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  res.json(asaService.saveProfiles(req.body));
}));

router.get('/config/:name', handleRoute(async (req, res) => {
  const allowed = ['GameUserSettings.ini', 'Game.ini', 'Engine.ini'];
  if (!allowed.includes(req.params.name)) throw new ValidationError('Datei nicht erlaubt.', 'CONFIG_NAME_NOT_ALLOWED');
  res.json(asaService.readIni(req.params.name));
}));

router.post('/config/:name', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  const allowed = ['GameUserSettings.ini', 'Game.ini', 'Engine.ini'];
  if (!allowed.includes(req.params.name)) throw new ValidationError('Datei nicht erlaubt.', 'CONFIG_NAME_NOT_ALLOWED');
  const content = String(req.body.content || '');
  if (content.length > 1024 * 1024) throw new ValidationError('Config-Inhalt ist zu groß.', 'CONFIG_CONTENT_TOO_LARGE');
  res.json(asaService.writeIni(req.params.name, content));
}));

router.post('/detect-server', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  res.json(setupService.detectServerRoot(req.body.path));
}));

router.post('/actions/start', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  const result = await asaService.startServer();
  await webhookService.notify('ASA gestartet', 'Der ARK-Server wurde über das Webpanel gestartet.');
  res.json({ ok: true, ...result });
}));

router.post('/actions/stop', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  requireSensitiveActionAuth(req);
  const result = await asaService.stopServer();
  await webhookService.notify('ASA gestoppt', 'Der ARK-Server wurde über das Webpanel gestoppt.');
  res.json({ ok: true, ...result });
}));

router.post('/actions/restart', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  requireSensitiveActionAuth(req);
  const result = await asaService.restartServer();
  await webhookService.notify('ASA neugestartet', 'Der ARK-Server wurde über das Webpanel neugestartet.');
  res.json({ ok: true, ...result });
}));

router.post('/actions/reboot-host', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  requireSensitiveActionAuth(req);
  const result = await asaService.rebootHost(req.body || {});
  res.json({ ok: true, ...result });
}));

router.post('/actions/panel-update', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  requireSensitiveActionAuth(req);
  const result = await asaService.updateAndRestartPanel();
  res.json({ ok: true, ...result });
}));

router.post('/actions/panel-restart', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  requireSensitiveActionAuth(req);
  const result = await asaService.restartPanelService();
  res.json({ ok: true, ...result });
}));

router.post('/actions/panel-firewall-check', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  const port = Number(req.body?.port || defaults.app.port || 3000);
  res.json({ ok: true, result: await asaService.checkPanelFirewall(port) });
}));

router.post('/actions/panel-firewall-open', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  requireSensitiveActionAuth(req);
  const port = Number(req.body?.port || defaults.app.port || 3000);
  res.json({ ok: true, result: await asaService.openPanelFirewall(port) });
}));

router.get('/actions/panel-autostart-status', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  res.json({ ok: true, result: await asaService.getPanelAutostartStatus() });
}));

router.post('/actions/panel-autostart', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  requireSensitiveActionAuth(req);
  const enabled = !!req.body?.enabled;
  const result = await asaService.setPanelAutostart(enabled);
  if (enabled) {
    try {
      await asaService.restartPanelService();
    } catch (_error) {
      // task is enabled already; restart may still require manual follow-up
    }
  }
  res.json({ ok: true, result });
}));

router.get('/actions/asa-autostart-status', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  res.json({ ok: true, result: await asaService.getAsaAutostartStatus() });
}));

router.post('/actions/asa-autostart', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  requireSensitiveActionAuth(req);
  const enabled = !!req.body?.enabled;
  res.json({ ok: true, result: await asaService.setAsaAutostart(enabled) });
}));

router.post('/actions/asa-update-check', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  const check = await asaService.checkForServerUpdate();
  let autoUpdated = false;
  if (check.updateAvailable && store.getSettings().autoAsaUpdate === true) {
    requireSensitiveActionAuth(req);
    await asaService.installOrUpdateServer();
    autoUpdated = true;
  }
  res.json({ ok: true, check, autoUpdated });
}));

router.post('/actions/asa-update', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  requireSensitiveActionAuth(req);
  if (store.getSettings().autoBackupBeforeUpdate !== false) {
    await backupService.createBackup('pre-update');
  }
  const result = await asaService.installOrUpdateServer();
  await webhookService.notify('ASA-Update', 'Serverdateien wurden installiert/aktualisiert.');
  res.json({ ok: true, ...result });
}));

router.get('/backups', handleRoute(async (_req, res) => {
  res.json({ backups: backupService.listBackups() });
}));

router.post('/backups/create', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  const result = await backupService.createBackup(req.body.type || 'manual');
  res.json({ ok: true, ...result });
}));

router.post('/backups/restore', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  actionPolicyService.requireConfirmation('restore-backup', req.body || {});
  requireSensitiveActionAuth(req);
  const result = await backupService.restoreBackup(req.body.name, req.body.mode || 'full');
  res.json({ ok: true, ...result });
}));

router.post('/backups/validate', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  const result = await backupService.validateBackup(req.body.name);
  res.json({ ok: true, ...result });
}));

router.get('/backups/download/:name', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  const resolved = backupService.resolveBackupFile(req.params.name);
  res.download(resolved.file, resolved.name);
}));

router.get('/logs', handleRoute(async (req, res) => {
  res.json({ log: monitorService.getRecentLogs(Number(req.query.lines || 200)) });
}));

router.get('/players', handleRoute(async (_req, res) => {
  res.json({ players: monitorService.parsePlayers() });
}));

router.get('/settings', handleRoute(async (_req, res) => {
  res.json(store.getSettings());
}));

router.post('/settings', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  const settings = { ...store.getSettings(), ...req.body };
  store.saveSettings(settings);
  res.json({ ok: true, settings });
}));

router.get('/panel-env', handleRoute(async (_req, res) => {
  const env = readPanelEnv();
  const host = env.HOST || defaults.app.host;
  const httpsEnabled = ['1', 'true', 'yes', 'on'].includes(String(env.HTTPS_ENABLED || defaults.app.httpsEnabled).toLowerCase());
  const certPath = env.HTTPS_CERT_PATH || defaults.app.httpsCertPath || '';
  const keyPath = env.HTTPS_KEY_PATH || defaults.app.httpsKeyPath || '';
  res.json({
    host,
    port: Number(env.PORT || defaults.app.port),
    httpsEnabled,
    httpsCertPath: certPath,
    httpsKeyPath: keyPath,
    lanEnabled: host === '0.0.0.0' || host === '::'
  });
}));

router.post('/panel-env', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  const lanEnabled = !!req.body.lanEnabled;
  const host = String(req.body.host || (lanEnabled ? '0.0.0.0' : '127.0.0.1')).trim();
  const port = Number(req.body.port || 3000);
  const httpsEnabled = !!req.body.httpsEnabled;
  const httpsCertPath = String(req.body.httpsCertPath || '').trim();
  const httpsKeyPath = String(req.body.httpsKeyPath || '').trim();
  if (!host) throw new ValidationError('HOST darf nicht leer sein.', 'PANEL_HOST_REQUIRED');
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new ValidationError('PORT muss zwischen 1 und 65535 liegen.', 'PANEL_PORT_INVALID');
  if (httpsEnabled && (!httpsCertPath || !httpsKeyPath)) {
    throw new ValidationError('Für HTTPS werden Zertifikat- und Key-Pfad benötigt.', 'HTTPS_CERT_KEY_REQUIRED');
  }
  writePanelEnv({
    HOST: lanEnabled ? '0.0.0.0' : host,
    PORT: String(port),
    HTTPS_ENABLED: httpsEnabled ? 'true' : 'false',
    HTTPS_CERT_PATH: httpsEnabled ? httpsCertPath : '',
    HTTPS_KEY_PATH: httpsEnabled ? httpsKeyPath : ''
  });
  res.json({ ok: true, message: 'Panel-Variablen gespeichert. Neustart erforderlich.' });
}));

router.get('/tasks', handleRoute(async (_req, res) => {
  res.json({ tasks: schedulerService.listTasks() });
}));

router.get('/tasks/runtime', handleRoute(async (_req, res) => {
  res.json({ tasks: schedulerRunnerService.listRuntime() });
}));

router.post('/tasks', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  res.json({ ok: true, tasks: schedulerService.saveTasks(req.body.tasks || []) });
}));

router.post('/tasks/:id/run', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  requireSensitiveActionAuth(req);
  res.json(await schedulerRunnerService.runTaskNow(req.params.id));
}));

router.get('/versions', handleRoute(async (_req, res) => {
  res.json({ ...versionService.getUpdateInfo(), panelBackups: rollbackService.listPanelBackups() });
}));

router.get('/audit', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  res.json({ entries: auditService.listAuditLines(Number(req.query.limit || 200)) });
}));

router.get('/users', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  res.json({ users: userAdminService.listUsers() });
}));

router.post('/users', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  res.json({ ok: true, user: userAdminService.createUser(req.body || {}) });
}));

router.post('/users/:username', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  res.json({ ok: true, user: userAdminService.updateUser(req.params.username, req.body || {}) });
}));

router.delete('/users/:username', handleRoute(async (req, res) => {
  authService.requireRole(req, ['admin']);
  requireSensitiveActionAuth(req);
  res.json(userAdminService.deleteUser(req.params.username));
}));

router.get('/health', handleRoute(async (_req, res) => {
  res.json(await healthService.getHealth());
}));

router.use((error, _req, res, _next) => {
  logger.error('API failure', { error: error.message, code: error.code || 'INTERNAL_ERROR' });
  sendError(res, error, 500);
});

module.exports = router;
