function parseSchedule(cronLike) {
  const value = String(cronLike || '').trim();
  const interval = value.match(/^every:(\d+)m$/i);
  if (interval) {
    return { type: 'interval', minutes: Math.max(1, Number(interval[1])) };
  }
  const daily = value.match(/^daily:(\d{1,2}):(\d{2})$/i);
  if (daily) {
    const hour = Number(daily[1]);
    const minute = Number(daily[2]);
    if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
      return { type: 'daily', hour, minute };
    }
  }
  return null;
}

function isTaskDue(task, now = new Date(), lastRunAt = null) {
  if (!task?.enabled) return false;
  const schedule = parseSchedule(task.cronLike);
  if (!schedule) return false;
  if (schedule.type === 'interval') {
    if (!lastRunAt) return true;
    return now.getTime() - new Date(lastRunAt).getTime() >= schedule.minutes * 60 * 1000;
  }
  if (schedule.type === 'daily') {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const targetMinutes = schedule.hour * 60 + schedule.minute;
    if (nowMinutes < targetMinutes) return false;
    if (!lastRunAt) return true;
    const last = new Date(lastRunAt);
    return last.toDateString() !== now.toDateString();
  }
  return false;
}

function getNextRunAt(task, now = new Date(), lastRunAt = null) {
  const schedule = parseSchedule(task?.cronLike);
  if (!task?.enabled || !schedule) return null;
  if (schedule.type === 'interval') {
    if (!lastRunAt) return now.toISOString();
    const last = new Date(lastRunAt).getTime();
    return new Date(last + schedule.minutes * 60 * 1000).toISOString();
  }
  const next = new Date(now);
  next.setHours(schedule.hour, schedule.minute, 0, 0);
  if (next.getTime() <= now.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next.toISOString();
}

module.exports = { parseSchedule, isTaskDue, getNextRunAt };
