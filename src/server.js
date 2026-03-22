require('dotenv').config();

const express = require('express');
const path = require('path');
const apiRouter = require('./routes/api');

const app = express();
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';

app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/api', apiRouter);

app.listen(port, host, () => {
  console.log(`ARK ASA Admin Panel läuft auf http://${host}:${port}`);
});
