const store = require('./store');
const logger = require('./logger');
const { parseSchedule } = require('../util/taskSchedule');

const SUPPORTED_TASK_TYPES = new Set(['backup', 'asa-update', 'panel-update', 'reboot-host']);

function listTasks() {
  const settings = store.getSettings();
  return settings.plannedTasks || [];
}

function saveTasks(tasks) {
  if (!Array.isArray(tasks)) throw new Error('Tasks müssen ein Array sein.');
  const settings = store.getSettings();
  settings.plannedTasks = tasks.map(task => ({
    id: String(task.id || `task-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`),
    type: normalizeTaskType(task.type),
    cronLike: normalizeSchedule(task.cronLike),
    enabled: !!task.enabled,
    payload: task.payload || {}
  }));
  store.saveSettings(settings);
  logger.audit('system', 'save-planned-tasks', { count: settings.plannedTasks.length });
  return settings.plannedTasks;
}

function normalizeTaskType(type) {
  const value = String(type || 'backup');
  if (!SUPPORTED_TASK_TYPES.has(value)) {
    throw new Error(`Task-Typ nicht unterstützt: ${value}`);
  }
  return value;
}

function normalizeSchedule(cronLike) {
  const value = String(cronLike || '').trim();
  if (!parseSchedule(value)) {
    throw new Error(`Ungültiges Zeitformat: ${value}. Erlaubt: every:<N>m oder daily:HH:MM`);
  }
  return value;
}

module.exports = { listTasks, saveTasks, normalizeTaskType, normalizeSchedule, SUPPORTED_TASK_TYPES };
