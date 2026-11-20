/** Keep sub-minute time across every pause/save instead of rounding each session down. */
export function elapsedMilliseconds(task: {
  timeSpentMinutes: number;
  timerRemainderMs?: number;
  timerStartedAt: Date | string | null;
}, now: number) {
  return Math.max(0, task.timeSpentMinutes * 60000 + (task.timerRemainderMs ?? 0) +
    (task.timerStartedAt ? Math.max(0, now - new Date(task.timerStartedAt).getTime()) : 0));
}

export function bankTime(milliseconds: number) {
  const total = Math.max(0, Math.floor(milliseconds));
  return { timeSpentMinutes: Math.floor(total / 60000), timerRemainderMs: total % 60000 };
}

/** Stored billable time, including the partial minute retained by focus checkpoints. */
export function storedMinutes(task: { timeSpentMinutes: number; timerRemainderMs?: number }) {
  return task.timeSpentMinutes + (task.timerRemainderMs ?? 0) / 60000;
}
