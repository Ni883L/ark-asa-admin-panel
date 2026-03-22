const path = require('path');
const defaults = require('../config/defaults');
const { ensureDir, ensureFile, readJson, writeJson } = require('../util/fsx');
const { hashPassword } = require('../util/passwords');

function bootstrap() {
  ensureDir(defaults.paths.dataDir);
  ensureDir(defaults.paths.logDir);
  ensureDir(defaults.paths.backupDir);
  ensureDir(defaults.paths.tempDir);

  ensureFile(defaults.files.settings, JSON.stringify({
    initialized: false,
    backupRetention: 14,
    autoBackupBeforeUpdate: true,
    autoRestartOnCrash: false,
    webhookEnabled: false,
    plannedTasks: []
  }, null, 2));

  ensureFile(defaults.files.profiles, JSON.stringify({
    activeProfileId: 'default',
    profiles: [
      {
        id: 'default',
        name: 'Standardserver',
        map: 'TheIsland_WP',
        sessionName: 'ASA Server',
        ports: { game: 7777, query: 27015, rcon: 27020 },
        adminPassword: '',
        serverPassword: '',
        clusterId: '',
        extraArgs: '',
        rawCommandLine: '',
        autoRestart: false
      }
    ]
  }, null, 2));

  ensureFile(defaults.files.users, JSON.stringify({
    users: [
      {
        username: 'admin',
        role: 'admin',
        passwordHash: hashPassword('admin123!ChangeNow'),
        createdAt: new Date().toISOString(),
        mustChangePassword: true
      }
    ],
    loginAttempts: {},
    blockedIps: {}
  }, null, 2));
}

function getSettings() { return readJson(defaults.files.settings, {}); }
function saveSettings(settings) { writeJson(defaults.files.settings, settings); }
function getProfiles() { return readJson(defaults.files.profiles, { activeProfileId: null, profiles: [] }); }
function saveProfiles(data) { writeJson(defaults.files.profiles, data); }
function getUsers() { return readJson(defaults.files.users, { users: [], loginAttempts: {}, blockedIps: {} }); }
function saveUsers(data) { writeJson(defaults.files.users, data); }

function getActiveProfile() {
  const data = getProfiles();
  return data.profiles.find(profile => profile.id === data.activeProfileId) || data.profiles[0] || null;
}

module.exports = { bootstrap, getSettings, saveSettings, getProfiles, saveProfiles, getUsers, saveUsers, getActiveProfile };
