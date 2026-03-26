const schedulerService = require('./schedulerService');
const backupService = require('./backupService');
const asaService = require('./asaService');
const logger = require('./logger');
const { parseSchedule, isTaskDue, getNextRunAt } = require('../util/taskSchedule');

const state = {
  timer: null,
  running: false,
  lastRunByTask: new Map()
};

async function executeTask(task) {
  if (task.type === 'backup') {
    await backupService.createBackup(task.payload?.type || 'scheduled');
    return;
  }
  if (task.type === 'asa-update') {
    await asaService.installOrUpdateServer();
    return;
  }
  if (task.type === 'panel-update') {
    await asaService.selfUpdate();
    return;
  }
  if (task.type === 'reboot-host') {
    await asaService.rebootHost({ ...task.payload, confirm: true });
  }
}

function findTaskById(taskId) {
  return schedulerService.listTasks().find(task => task.id === taskId) || null;
}

async function tick() {
  if (state.running) return;
  state.running = true;
  try {
    const now = new Date();
    const tasks = schedulerService.listTasks();
    for (const task of tasks) {
      const lastRunAt = state.lastRunByTask.get(task.id) || null;
      if (!isTaskDue(task, now, lastRunAt)) continue;
      try {
        await executeTask(task);
        state.lastRunByTask.set(task.id, now.toISOString());
        logger.audit('system', 'scheduled-task-run', { id: task.id, type: task.type, cronLike: task.cronLike });
      } catch (error) {
        logger.error('Scheduled task failed', { id: task.id, type: task.type, error: error.message });
      }
    }
  } finally {
    state.running = false;
  }
}

function start() {
  if (state.timer) return;
  state.timer = setInterval(() => {
    tick().catch(() => {});
  }, 60 * 1000);
  tick().catch(() => {});
}

function stop() {
  if (!state.timer) return;
  clearInterval(state.timer);
  state.timer = null;
}

function listRuntime() {
  const now = new Date();
  return schedulerService.listTasks().map(task => {
    const lastRunAt = state.lastRunByTask.get(task.id) || null;
    return {
      ...task,
      scheduleValid: !!parseSchedule(task.cronLike),
      lastRunAt,
      nextRunAt: getNextRunAt(task, now, lastRunAt)
    };
  });
}

async function runTaskNow(taskId) {
  const task = findTaskById(String(taskId || ''));
  if (!task) throw new Error('Task nicht gefunden.');
  await executeTask(task);
  const now = new Date().toISOString();
  state.lastRunByTask.set(task.id, now);
  logger.audit('system', 'scheduled-task-run-manual', { id: task.id, type: task.type });
  return { ok: true, id: task.id, runAt: now };
}

module.exports = { start, stop, tick, isTaskDue, parseSchedule, listRuntime, runTaskNow, findTaskById };
