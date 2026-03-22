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

const router = express.Router();

router.use((req, res, next) => {
  try {
    authService.requireAuth(req);
    next();
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

router.get('/bootstrap', (_req, res) => {
  const settings = store.getSettings();
  res.json({
    initialized: !!settings.initialized,
    appName: defaults.app.name,
    host: os.hostname(),
    version: require('../../package.json').version
  });
});

router.post('/bootstrap', (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    const settings = { ...store.getSettings(), ...req.body, initialized: true };
    store.saveSettings(settings);
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
    const result = await asaService.rebootHost();
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
router.post('/actions/asa-update', async (req, res) => {
  try {
    authService.requireRole(req, ['admin']);
    if (store.getSettings().autoBackupBeforeUpdate !== false) {
      await backupService.createBackup('pre-update');
    }
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

router.get('/health', (_req, res) => res.json({ ok: true }));
router.use((error, _req, res, _next) => {
  logger.error('API failure', { error: error.message });
  res.status(500).json({ error: 'Interner Serverfehler.' });
});

module.exports = router;
