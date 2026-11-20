import { storedMinutes } from "./focus-timer";

/** Core payout math. All money math in plain numbers on minute/rate inputs;
 *  DB stores numeric strings — convert at the API boundary. */

export function projectedUsd(
  minutes: number,
  minRate: number,
  maxRate: number
): { min: number; max: number } {
  const hours = minutes / 60;
  return { min: hours * minRate, max: hours * maxRate };
}

/** Review determines the payable rate; pending work retains its estimate range. */
export function approvalAdjustedUsd(usd: { min: number; max: number }, approval: string) {
  if (approval === "accepted") return { min: usd.max, max: usd.max };
  if (approval === "rejected") return { min: usd.min, max: usd.min };
  return usd;
}

interface PayoutTask {
  taskType?: string;
  statusKanbanGroup?: string | null;
  timeSpentMinutes: number;
  timerRemainderMs?: number;
  minRate: number;
  maxRate: number;
  approvalStatus: string;
  statusShowOnBoard?: boolean | null;
}

/** Reviews have one hourly rate (stored in minRate); approval is not applicable. */
export function taskPayout(task: PayoutTask) {
  if (task.taskType === "review") return projectedUsd(storedMinutes(task), task.minRate, task.minRate);
  return approvalAdjustedUsd(projectedUsd(storedMinutes(task), task.minRate, task.maxRate), task.approvalStatus);
}

/** Shared by the API and filtered board: revoked excluded, pending not yet earned. */
export function summarizePayouts(tasks: PayoutTask[]) {
  let usdMin = 0, usdMax = 0, byStatusUsd = 0;
  for (const task of tasks) {
    if (task.statusShowOnBoard === false) continue;
    const usd = taskPayout(task);
    usdMin += usd.min;
    usdMax += usd.max;
    if (task.taskType === "review"
      ? task.statusKanbanGroup === "completed" || task.statusKanbanGroup === "paid"
      : task.approvalStatus === "accepted" || task.approvalStatus === "rejected") byStatusUsd += usd.min;
  }
  return { usdMin, usdMax, byStatusUsd };
}

export function projectedInr(
  minutes: number,
  minRate: number,
  maxRate: number,
  rate: number
): { min: number; max: number } {
  const usd = projectedUsd(minutes, minRate, maxRate);
  return { min: usd.min * rate, max: usd.max * rate };
}

/** "$266.67 – $300.00" */
export function usdRangeText(min: number, max: number): string {
  const f = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return min === max ? `$${f.format(min)}` : `$${f.format(min)} – $${f.format(max)}`;
}

/** "₹25,580 – ₹28,777" */
export function inrRangeText(min: number, max: number): string {
  const f = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
  return min === max ? `₹${f.format(min)}` : `₹${f.format(min)} – ₹${f.format(max)}`;
}

export function canAssignPayoutWeek(stage: string | null | undefined) {
  return stage === "completed" || stage === "paid";
}
