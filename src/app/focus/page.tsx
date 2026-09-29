"use client";

import { useCallback, useEffect, useState } from "react";
import type { Project, Status, Task } from "@/lib/types";
import {
  formatRateINR,
  fromDateInputValue,
  toDateInputValue,
} from "@/lib/format";
import { projectedUsd, usdRangeText, inrRangeText } from "@/lib/payout";

/** Live elapsed minutes incl. the running session */
function liveMinutes(t: Task, now: number): number {
  if (!t.timerStartedAt) return t.timeSpentMinutes;
  return (
    t.timeSpentMinutes +
    Math.max(0, Math.floor((now - new Date(t.timerStartedAt).getTime()) / 1000))
  );
}

function hhmmss(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export default function FocusPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [rate, setRate] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [customMinutes, setCustomMinutes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [t, p, s, r] = await Promise.all([
      fetch("/api/tasks").then((res) => res.json()),
      fetch("/api/projects").then((res) => res.json()),
      fetch("/api/statuses").then((res) => res.json()),
      fetch("/api/rate").then((res) => res.json()),
    ]);
    setTasks(t);
    setProjects(p);
    setStatuses(s);
    setRate(r.rate ?? 0);
    setSelectedId((prev) => {
      if (prev && t.some((x: Task) => x.id === prev)) return prev;
      const running = t.find((x: Task) => x.timerStartedAt);
      const inProgress = t.find(
        (x: Task) => x.statusKanbanGroup === "in_progress" && x.statusShowOnBoard
      );
      return (running ?? inProgress ?? t[0])?.id ?? null;
    });
  }, []);

  useEffect(() => {
    load();
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(tick);
  }, [load]);

  const task = tasks.find((t) => t.id === selectedId) ?? null;
  const running = task?.timerStartedAt != null;
  const elapsedSeconds = task ? liveMinutes(task, now) * 60 : 0;
  const banked = task?.timeSpentMinutes ?? 0;
  const liveElapsedMin = Math.floor(elapsedSeconds / 60);

  const usd = task
    ? projectedUsd(liveElapsedMin, task.minRate, task.maxRate)
    : { min: 0, max: 0 };

  const patch = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!task) return;
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError(j.error ?? "Failed to save");
        return;
      }
      setError("");
      load();
    },
    [task, load]
  );

  async function timer(action: "start" | "pause" | "resume" | "stop") {
    if (!task) return;
    setBusy(true);
    const res = await fetch(`/api/tasks/${task.id}/timer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Timer action failed");
      return;
    }
    setError("");
    setNow(Date.now());
    load();
  }

  async function adjust(delta: number) {
    if (!task) return;
    await fetch(`/api/tasks/${task.id}/adjust-minutes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delta }),
    });
    load();
  }

  async function customAdjust(sign: 1 | -1) {
    const v = Math.round(Number(customMinutes));
    if (Number.isNaN(v) || v <= 0) return;
    await adjust(sign * v);
    setCustomMinutes("");
  }

  async function resetTimer() {
    if (!task || banked === 0) return;
    if (!confirm(`Reset logged time to 0 for Task ${task.taskNumber}?`)) return;
    await patch({ timeSpentMinutes: 0 });
  }

  async function completeAndReview() {
    if (!task) return;
    if (running) await timer("stop");
    const completed = statuses.find((s) => s.name === "Completed");
    if (!completed) return;
    await patch({ statusId: completed.id, approvalStatus: "pending" });
  }

  if (!task) {
    return (
      <div className="card p-16 text-center text-muted">
        No tasks yet — create one with <strong>+ Log Task</strong> in the top
        bar, then come back here to work on it.
      </div>
    );
  }

  const selectable = tasks.filter(
    (t) => t.statusShowOnBoard !== false
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <span className="chip bg-emerald-100 text-emerald-700 border border-emerald-200">
            Task {task.taskNumber}
          </span>
          <h1 className="text-xl font-bold">Active Task Workbench</h1>
        </div>
        <select
          className="field w-64"
          value={selectedId ?? ""}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          {selectable.map((t) => (
            <option key={t.id} value={t.id}>
              Task {t.taskNumber} — {t.projectName} ({t.timeSpentMinutes}m logged)
            </option>
          ))}
        </select>
      </div>
      <p className="text-sm text-muted -mt-3">
        Edit fields directly without modal popups. Everything saves to the
        database instantly.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* Timer card */}
        <div className="card p-6 flex flex-col items-center text-center">
          <p className="label flex items-center gap-1.5 text-muted">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 3" />
            </svg>
            ELAPSED TASK DURATION
          </p>
          <p
            className={`font-mono font-bold text-6xl tabular-nums mt-4 tracking-tight ${
              running ? "text-emerald-600" : "text-foreground"
            }`}
          >
            {hhmmss(elapsedSeconds)}
          </p>
          <p className="chip bg-emerald-50 text-emerald-700 border border-emerald-200 mt-3">
            {Math.floor(liveElapsedMin / 60)}h {liveElapsedMin % 60}m logged ({liveElapsedMin} minutes)
          </p>

          <div className="flex items-center gap-2 mt-5 w-full max-w-xs">
            {running ? (
              <>
                <button
                  className="btn-ghost flex-1 py-3 text-sm font-semibold"
                  onClick={() => timer("pause")}
                  disabled={busy}
                >
                  ⏸ Pause
                </button>
                <button
                  className="flex-1 py-3 text-sm font-semibold rounded-[0.6rem] bg-red-500 text-white hover:bg-red-600 transition-colors"
                  onClick={() => timer("stop")}
                  disabled={busy}
                >
                  ⏹ Stop
                </button>
              </>
            ) : (
              <>
                <button
                  className="btn-primary flex-1 py-3 text-sm font-semibold"
                  onClick={() => timer(banked > 0 ? "resume" : "start")}
                  disabled={busy}
                >
                  ▶ {banked > 0 ? "Resume Timer" : "Start Timer"}
                </button>
                <button
                  className="btn-ghost w-11 py-3"
                  title="Reset logged minutes"
                  onClick={resetTimer}
                >
                  ⟲
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-1.5 mt-4 text-xs text-muted">
            <span>Presets:</span>
            {[5, 15, -5, -15].map((m) => (
              <button
                key={m}
                onClick={() => adjust(m)}
                className={`chip border ${
                  m > 0
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-red-50 text-red-600 border-red-200"
                }`}
              >
                {m > 0 ? `+${m}m` : `${m}m`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 mt-2 text-xs">
            <span className="text-muted">Custom:</span>
            <input
              type="number"
              min="0"
              className="field w-20 py-1 text-center"
              value={customMinutes}
              onChange={(e) => setCustomMinutes(e.target.value)}
              placeholder="min"
            />
            <button onClick={() => customAdjust(1)} className="chip bg-emerald-50 text-emerald-700 border border-emerald-200">
              + Add
            </button>
            <button onClick={() => customAdjust(-1)} className="chip bg-red-50 text-red-600 border border-red-200">
              − Deduct
            </button>
          </div>

          <div className="w-full mt-6 rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 flex items-center justify-between text-left">
            <div>
              <p className="text-[0.65rem] font-bold text-emerald-700/80 uppercase tracking-wide">
                Live Accrued Earnings
              </p>
              <p className="text-[0.6rem] text-emerald-600/70 uppercase tracking-wider mt-0.5">
                Real-time compute
              </p>
            </div>
            <div className="text-right text-sm">
              <p className="text-muted text-xs">
                USD Projected:{" "}
                <span className="font-bold text-emerald-800">
                  {usdRangeText(usd.min, usd.max)}
                </span>
              </p>
              <p className="text-muted text-xs mt-1">
                INR Projected{" "}
                {rate > 0 && <span>(@{formatRateINR(rate)}):</span>}{" "}
                <span className="font-bold text-emerald-800">
                  {rate > 0 ? inrRangeText(usd.min * rate, usd.max * rate) : "—"}
                </span>
              </p>
            </div>
          </div>
        </div>

        {/* Edit card */}
        <div className="card p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label flex items-baseline justify-between mb-1.5">
                <span>Task Number / Header</span>
                <span className="text-[0.65rem] text-emerald-600">Editable</span>
              </label>
              <input
                type="number"
                min="1"
                className="field bg-emerald-50/60 border-emerald-200 font-semibold"
                defaultValue={task.taskNumber}
                key={`tasknum-${task.id}-${task.taskNumber}`}
                onBlur={(e) => {
                  const v = Math.round(Number(e.target.value));
                  if (!Number.isNaN(v) && v >= 1 && v !== task.taskNumber)
                    patch({ taskNumber: v });
                }}
              />
            </div>
            <div>
              <label className="label block mb-1.5">Project</label>
              <select
                className="field"
                value={task.projectId}
                onChange={(e) => patch({ projectId: e.target.value })}
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block mb-1.5">Task UUID</label>
              <input
                className="field font-mono text-xs"
                defaultValue={task.taskUuid}
                onBlur={(e) =>
                  e.target.value !== task.taskUuid &&
                  patch({ taskUuid: e.target.value })
                }
              />
            </div>
            <div>
              <label className="label block mb-1.5">Stage UUID</label>
              <input
                className="field font-mono text-xs"
                defaultValue={task.stageUuid}
                onBlur={(e) =>
                  e.target.value !== task.stageUuid &&
                  patch({ stageUuid: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block mb-1.5">Start Date Time</label>
              <input
                type="datetime-local"
                className="field"
                value={toDateInputValue(task.startAt)}
                onChange={(e) =>
                  patch({ startAt: fromDateInputValue(e.target.value) })
                }
              />
            </div>
            <div>
              <label className="label flex items-baseline justify-between mb-1.5">
                <span>End Date Time</span>
                <button
                  className="text-[0.65rem] text-primary font-semibold"
                  onClick={() => patch({ endAt: new Date().toISOString() })}
                >
                  Set Now
                </button>
              </label>
              <input
                type="datetime-local"
                className="field"
                value={toDateInputValue(task.endAt)}
                onChange={(e) =>
                  patch({ endAt: fromDateInputValue(e.target.value) })
                }
              />
            </div>
          </div>

          <div className="rounded-xl border border-line bg-slate-50/60 p-4">
            <p className="label mb-2.5 flex items-center gap-1.5">
              <span className="text-amber-500">⌛</span> TASK HOURLY RATES (MIN & MAX)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label block mb-1.5 text-xs">Min Rate ($/hr – Base)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className="field"
                  defaultValue={task.minRate}
                  onBlur={(e) =>
                    Number(e.target.value) !== task.minRate &&
                    patch({ minRate: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <label className="label block mb-1.5 text-xs">Max Rate ($/hr – Bonus)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className="field"
                  defaultValue={task.maxRate}
                  onBlur={(e) =>
                    Number(e.target.value) !== task.maxRate &&
                    patch({ maxRate: Number(e.target.value) })
                  }
                />
              </div>
            </div>
          </div>

          <div>
            <label className="label block mb-1.5">Task Context / Notes</label>
            <textarea
              className="field"
              rows={3}
              defaultValue={task.notes}
              onBlur={(e) =>
                e.target.value !== task.notes && patch({ notes: e.target.value })
              }
              placeholder="e.g. Multi-turn reasoning, complex formatting…"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-line">
            <p className="text-[0.7rem] text-muted flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" />
              </svg>
              Saves elapsed time and rates to the database.
            </p>
            <div className="flex gap-2">
              <button className="btn-ghost px-4 py-2 text-sm" onClick={() => load()}>
                💾 Save Progress
              </button>
              <button
                className="btn-primary px-4 py-2 text-sm"
                onClick={completeAndReview}
              >
                ✓ Complete Task & Send to Review
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
