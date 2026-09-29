"use client";

import { useEffect, useState } from "react";
import type { Project, Status, Task } from "@/lib/types";
import {
  formatHoursHint,
  formatRateINR,
  fromDateInputValue,
  toDateInputValue,
} from "@/lib/format";
import { inrRangeText, projectedUsd, usdRangeText } from "@/lib/payout";

interface Props {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function TaskModal({ task, open, onClose, onSaved }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [rate, setRate] = useState(0);
  const [form, setForm] = useState<Record<string, string | number | null>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/statuses").then((r) => r.json()),
      fetch("/api/rate").then((r) => r.json()),
    ]).then(([p, s, r]) => {
      setProjects(p);
      setStatuses(s);
      setRate(r.rate ?? 0);
    });
  }, [open]);

  useEffect(() => {
    if (!task) return;
    setForm({
      projectId: task.projectId,
      taskUuid: task.taskUuid,
      stageUuid: task.stageUuid,
      approvalStatus: task.approvalStatus,
      reviewerComment: task.reviewerComment,
      timeSpentMinutes: task.timeSpentMinutes,
      statusId: task.statusId,
      startAt: toDateInputValue(task.startAt),
      endAt: toDateInputValue(task.endAt),
      minRate: task.minRate,
      maxRate: task.maxRate,
      notes: task.notes,
    });
    setError("");
  }, [task, open]);

  if (!open || !task) return null;

  const minutes = Number(form.timeSpentMinutes ?? 0);
  const minRate = Number(form.minRate ?? 0);
  const maxRate = Number(form.maxRate ?? 0);
  const usd = projectedUsd(minutes, minRate, maxRate);

  async function save() {
    setSaving(true);
    setError("");
    const payload: Record<string, unknown> = {
      projectId: form.projectId,
      taskUuid: form.taskUuid,
      stageUuid: form.stageUuid,
      approvalStatus: form.approvalStatus,
      reviewerComment: form.reviewerComment,
      timeSpentMinutes: minutes,
      statusId: form.statusId,
      startAt: fromDateInputValue(String(form.startAt ?? "")),
      endAt: fromDateInputValue(String(form.endAt ?? "")),
      minRate,
      maxRate,
      notes: form.notes,
    };
    const res = await fetch(`/api/tasks/${task!.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Failed to save");
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-16 overflow-y-auto">
      <div className="card w-full max-w-lg overflow-hidden">
        <div className="bg-header text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <span className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-sm">
              ✎
            </span>
            Edit Annotation Task
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-lg leading-none">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label flex items-baseline justify-between mb-1.5">
                <span>Task Number</span>
                <span className="text-[0.65rem] text-emerald-600 font-medium">
                  Auto-incremented
                </span>
              </label>
              <input
                className="field bg-emerald-50/60 border-emerald-200 font-semibold"
                value={`Task ${task.taskNumber}`}
                disabled
              />
            </div>
            <div>
              <label className="label block mb-1.5">Project</label>
              <select
                className="field"
                value={String(form.projectId ?? "")}
                onChange={(e) => setForm({ ...form, projectId: e.target.value })}
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
                value={String(form.taskUuid ?? "")}
                onChange={(e) => setForm({ ...form, taskUuid: e.target.value })}
              />
            </div>
            <div>
              <label className="label block mb-1.5">Stage UUID</label>
              <input
                className="field font-mono text-xs"
                value={String(form.stageUuid ?? "")}
                onChange={(e) => setForm({ ...form, stageUuid: e.target.value })}
              />
            </div>
          </div>

          <div>
            <label className="label block mb-1.5">Approval Status</label>
            <select
              className="field"
              value={String(form.approvalStatus ?? "pending")}
              onChange={(e) => setForm({ ...form, approvalStatus: e.target.value })}
            >
              <option value="pending">Pending Review</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div>
            <label className="label flex items-baseline justify-between mb-1.5">
              <span>Reviewer's Comment</span>
              <span className="text-[0.65rem] text-muted font-normal">
                Synced to sheet Column 15
              </span>
            </label>
            <textarea
              className="field"
              rows={2}
              value={String(form.reviewerComment ?? "")}
              onChange={(e) => setForm({ ...form, reviewerComment: e.target.value })}
              placeholder="e.g. Approved with bonus for high fidelity…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block mb-1.5">Time (Minutes)</label>
              <input
                type="number"
                min="0"
                className="field"
                value={minutes}
                onChange={(e) =>
                  setForm({ ...form, timeSpentMinutes: Number(e.target.value) })
                }
              />
              <p className="text-[0.7rem] text-muted mt-1">{formatHoursHint(minutes)}</p>
            </div>
            <div>
              <label className="label block mb-1.5">Stage Status</label>
              <div className="flex flex-wrap gap-1.5">
                {statuses.map((s) => {
                  const active = form.statusId === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => setForm({ ...form, statusId: s.id })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        active
                          ? "bg-primary text-white border-primary"
                          : "bg-surface text-muted border-line hover:border-primary/50"
                      }`}
                    >
                      {s.name}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block mb-1.5">Start Date & Time</label>
              <input
                type="datetime-local"
                className="field"
                value={String(form.startAt ?? "")}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
              />
            </div>
            <div>
              <label className="label block mb-1.5">End Date & Time</label>
              <input
                type="datetime-local"
                className="field"
                value={String(form.endAt ?? "")}
                onChange={(e) => setForm({ ...form, endAt: e.target.value })}
              />
            </div>
          </div>

          <div className="rounded-xl border border-line bg-slate-50/60 p-4">
            <p className="label mb-2.5">Hourly Rates ($/hr)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label block mb-1.5 text-xs">Min Rate ($/hr)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className="field"
                  value={minRate}
                  onChange={(e) => setForm({ ...form, minRate: Number(e.target.value) })}
                />
              </div>
              <div>
                <label className="label block mb-1.5 text-xs">Max Rate ($/hr – Accepted)</label>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  className="field"
                  value={maxRate}
                  onChange={(e) => setForm({ ...form, maxRate: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 flex items-center justify-between">
            <div>
              <p className="text-[0.65rem] font-bold text-emerald-700/80 uppercase tracking-wide">
                Projected USD Payout
              </p>
              <p className="font-bold text-emerald-800 text-lg">
                {usdRangeText(usd.min, usd.max)}
              </p>
            </div>
            {rate > 0 && (
              <div className="text-right">
                <p className="text-[0.65rem] font-bold text-emerald-700/80 uppercase tracking-wide">
                  INR Conversion (@{formatRateINR(rate)})
                </p>
                <p className="font-bold text-emerald-800 text-lg">
                  {inrRangeText(usd.min * rate, usd.max * rate)}
                </p>
              </div>
            )}
          </div>

          <div>
            <label className="label block mb-1.5">Notes / Instructions</label>
            <textarea
              className="field"
              rows={2}
              value={String(form.notes ?? "")}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-1 border-t border-line">
            <button className="btn-ghost px-4 py-2 text-sm" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-primary px-5 py-2 text-sm" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
