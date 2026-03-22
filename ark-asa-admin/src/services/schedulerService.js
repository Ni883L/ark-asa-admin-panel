const store = require('./store');
const logger = require('./logger');

function listTasks() {
  const settings = store.getSettings();
  return settings.plannedTasks || [];
}

function saveTasks(tasks) {
  if (!Array.isArray(tasks)) throw new Error('Tasks müssen ein Array sein.');
  const settings = store.getSettings();
  settings.plannedTasks = tasks.map(task => ({
    id: String(task.id || `task-${Date.now()}`),
    type: String(task.type || 'backup'),
    cronLike: String(task.cronLike || ''),
    enabled: !!task.enabled,
    payload: task.payload || {}
  }));
  store.saveSettings(settings);
  logger.audit('system', 'save-planned-tasks', { count: settings.plannedTasks.length });
  return settings.plannedTasks;
}

module.exports = { listTasks, saveTasks };
