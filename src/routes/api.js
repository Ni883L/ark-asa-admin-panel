const express = require('express');
const arkService = require('../services/arkService');

const router = express.Router();

router.get('/health', async (_req, res) => {
  res.json({ ok: true });
});

router.get('/status', async (_req, res) => {
  try {
    const data = await arkService.getStatus();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/config', (_req, res) => {
  res.json(arkService.getConfig());
});

router.get('/server-ini', (_req, res) => {
  try {
    res.json(arkService.readServerIni());
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/logs', async (req, res) => {
  try {
    const lines = Number(req.query.lines || 200);
    const log = await arkService.readLog(lines);
    res.json({ lines, log });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/start', async (_req, res) => {
  try {
    const result = await arkService.startServer();
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/stop', async (_req, res) => {
  try {
    const result = await arkService.stopServer();
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/restart', async (_req, res) => {
  try {
    const result = await arkService.restartServer();
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/reboot-host', async (_req, res) => {
  try {
    const result = await arkService.rebootHost();
    res.json({ ok: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/rcon', async (_req, res) => {
  res.status(501).json({ error: 'RCON ist als nächster Schritt vorgesehen, aber noch nicht implementiert.' });
});

module.exports = router;
