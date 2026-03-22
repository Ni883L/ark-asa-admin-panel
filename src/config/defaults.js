const path = require('path');

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

module.exports = {
  app: {
    name: process.env.APP_NAME || 'ARK ASA Admin Panel',
    host: process.env.HOST || '127.0.0.1',
    port: Number(process.env.PORT || 3000),
    baseUrl: process.env.APP_BASE_URL || 'http://127.0.0.1:3000',
    trustProxy: bool(process.env.TRUST_PROXY, false),
    httpsEnabled: bool(process.env.HTTPS_ENABLED, false),
    httpsCertPath: process.env.HTTPS_CERT_PATH || '',
    httpsKeyPath: process.env.HTTPS_KEY_PATH || '',
    sessionSecret: process.env.SESSION_SECRET || 'change-me',
    sessionTimeoutMinutes: Number(process.env.SESSION_TIMEOUT_MINUTES || 120),
    csrfHeaderName: process.env.CSRF_HEADER_NAME || 'x-csrf-token'
  },
  security: {
    enableRemoteAccess: bool(process.env.ENABLE_REMOTE_ACCESS, false),
    allowedIps: (process.env.ALLOWED_IPS || '').split(',').map(v => v.trim()).filter(Boolean),
    loginMaxAttempts: Number(process.env.LOGIN_MAX_ATTEMPTS || 5),
    loginBlockMinutes: Number(process.env.LOGIN_BLOCK_MINUTES || 15),
    loginWindowMinutes: Number(process.env.LOGIN_WINDOW_MINUTES || 15)
  },
  paths: {
    dataDir: process.env.DATA_DIR || path.join('runtime', 'data'),
    logDir: process.env.LOG_DIR || path.join('runtime', 'logs'),
    backupDir: process.env.BACKUP_DIR || path.join('runtime', 'backups'),
    tempDir: process.env.TEMP_DIR || path.join('runtime', 'temp')
  },
  files: {
    profiles: process.env.SERVER_PROFILES_FILE || path.join('runtime', 'data', 'profiles.json'),
    settings: process.env.APP_SETTINGS_FILE || path.join('runtime', 'data', 'settings.json'),
    users: process.env.USERS_FILE || path.join('runtime', 'data', 'users.json'),
    auditLog: process.env.AUDIT_LOG_FILE || path.join('runtime', 'logs', 'audit.log'),
    appLog: process.env.APP_LOG_FILE || path.join('runtime', 'logs', 'app.log')
  },
  asa: {
    root: process.env.ASA_SERVER_ROOT || 'C:\\ARK\\ASA',
    exe: process.env.ASA_SERVER_EXE || 'C:\\ARK\\ASA\\ShooterGame\\Binaries\\Win64\\ArkAscendedServer.exe',
    serviceName: process.env.ASA_SERVER_SERVICE_NAME || '',
    steamCmd: process.env.ASA_STEAMCMD_PATH || 'C:\\steamcmd\\steamcmd.exe',
    appId: process.env.ASA_APP_ID || '2430930',
    logPath: process.env.ASA_LOG_PATH || 'C:\\ARK\\ASA\\ShooterGame\\Saved\\Logs\\ShooterGame.log',
    savedArksPath: process.env.ASA_SAVEDARKS_PATH || 'C:\\ARK\\ASA\\ShooterGame\\Saved\\SavedArks',
    clusterPath: process.env.ASA_CLUSTER_PATH || '',
    configDir: process.env.ASA_CONFIG_DIR || 'C:\\ARK\\ASA\\ShooterGame\\Saved\\Config\\WindowsServer'
  },
  integrations: {
    discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL || '',
    rconEnabled: bool(process.env.RCON_ENABLED, false),
    rconHost: process.env.RCON_HOST || '127.0.0.1',
    rconPort: Number(process.env.RCON_PORT || 27020),
    rconPassword: process.env.RCON_PASSWORD || ''
  }
};
