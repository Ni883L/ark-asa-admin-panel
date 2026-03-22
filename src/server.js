require('dotenv').config();

const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const express = require('express');
const session = require('express-session');
const defaults = require('./config/defaults');
const store = require('./services/store');
const logger = require('./services/logger');
const { headers, ipFilter, csrf } = require('./middleware/security');
const { attachSessionUser } = require('./middleware/sessionUser');
const authRoutes = require('./routes/authRoutes');
const apiRoutes = require('./routes/apiRoutes');

store.bootstrap();

const app = express();
app.set('trust proxy', defaults.app.trustProxy);
app.use(headers);
app.use(ipFilter);
app.use(express.json({ limit: '2mb' }));
app.use(session({
  secret: defaults.app.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: defaults.app.httpsEnabled,
    maxAge: defaults.app.sessionTimeoutMinutes * 60 * 1000
  }
}));
app.use(attachSessionUser);
app.use(csrf);
app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use(express.static(path.join(__dirname, '..', 'public')));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

const server = defaults.app.httpsEnabled
  ? https.createServer({
      cert: fs.readFileSync(defaults.app.httpsCertPath),
      key: fs.readFileSync(defaults.app.httpsKeyPath)
    }, app)
  : http.createServer(app);

server.listen(defaults.app.port, defaults.app.host, () => {
  logger.info('Server started', { host: defaults.app.host, port: defaults.app.port });
  console.log(`${defaults.app.name} läuft auf ${defaults.app.httpsEnabled ? 'https' : 'http'}://${defaults.app.host}:${defaults.app.port}`);
});
