const express = require('express');
const authService = require('../services/authService');

const router = express.Router();

router.post('/login', (req, res) => {
  try {
    const result = authService.login(req, req.body.username, req.body.password);
    res.json({ ok: true, user: result });
  } catch (error) {
    res.status(401).json({ error: error.message });
  }
});

router.post('/logout', (req, res) => {
  authService.logout(req);
  res.json({ ok: true });
});

router.get('/me', (req, res) => {
  if (!req.session?.user) {
    return res.json({ authenticated: false });
  }
  res.json({
    authenticated: true,
    user: req.session.user,
    csrfToken: req.session.csrfToken
  });
});

router.post('/change-password', (req, res) => {
  try {
    authService.changePassword(req, req.body.currentPassword, req.body.newPassword);
    res.json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
