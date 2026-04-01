const express = require('express');
const authService = require('../services/authService');
const { sendError } = require('../util/http');

const router = express.Router();

router.post('/login', (req, res) => {
  try {
    const result = authService.login(req, req.body.username, req.body.password);
    res.json({ ok: true, user: result });
  } catch (error) {
    sendError(res, error, 401);
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
    sendError(res, error, 400);
  }
});

module.exports = router;
