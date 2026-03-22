const store = require('./store');
const logger = require('./logger');
const { hashPassword } = require('../util/passwords');
const { requireString } = require('../util/validators');

function listUsers() {
  const data = store.getUsers();
  return data.users.map(({ passwordHash, ...user }) => user);
}

function createUser(payload) {
  const data = store.getUsers();
  const username = requireString(payload.username, 'Benutzername');
  const password = requireString(payload.password, 'Passwort');
  const role = ['admin', 'readonly', 'moderator'].includes(payload.role) ? payload.role : 'readonly';

  if (data.users.some(user => user.username.toLowerCase() === username.toLowerCase())) {
    throw new Error('Benutzer existiert bereits.');
  }

  const user = {
    username,
    role,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
    mustChangePassword: !!payload.mustChangePassword
  };

  data.users.push(user);
  store.saveUsers(data);
  logger.audit('system', 'user-create', { username, role });
  return { username, role, createdAt: user.createdAt, mustChangePassword: user.mustChangePassword };
}

function updateUser(username, payload) {
  const data = store.getUsers();
  const user = data.users.find(item => item.username === username);
  if (!user) throw new Error('Benutzer nicht gefunden.');

  if (payload.role) {
    if (!['admin', 'readonly', 'moderator'].includes(payload.role)) {
      throw new Error('Ungültige Rolle.');
    }
    user.role = payload.role;
  }

  if (payload.password) {
    user.passwordHash = hashPassword(requireString(payload.password, 'Passwort'));
  }

  if (payload.mustChangePassword !== undefined) {
    user.mustChangePassword = !!payload.mustChangePassword;
  }

  store.saveUsers(data);
  logger.audit('system', 'user-update', { username, role: user.role });
  return { username: user.username, role: user.role, mustChangePassword: user.mustChangePassword };
}

function deleteUser(username) {
  const data = store.getUsers();
  if (data.users.length <= 1) throw new Error('Der letzte Benutzer darf nicht gelöscht werden.');
  const nextUsers = data.users.filter(item => item.username !== username);
  if (nextUsers.length === data.users.length) throw new Error('Benutzer nicht gefunden.');
  data.users = nextUsers;
  store.saveUsers(data);
  logger.audit('system', 'user-delete', { username });
  return { ok: true };
}

module.exports = { listUsers, createUser, updateUser, deleteUser };
