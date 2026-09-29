"use client";

import { useEffect, useMemo, useState } from "react";
import type { Project, Status, Task } from "@/lib/types";
import { formatHoursHint, formatRateINR } from "@/lib/format";
import { inrRangeText, projectedUsd, usdRangeText } from "@/lib/payout";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateTaskModal({ open, onClose, onCreated }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [rate, setRate] = useState(0);
  const [nextNumber, setNextNumber] = useState<number | null>(null);
  const [form, setForm] = useState({
    projectId: "",
    taskNumber: "",
    taskUuid: "",
    stageUuid: "",
    approvalStatus: "pending",
    reviewerComment: "",
    minutes: "",
    statusId: "",
    startAt: "",
    endAt: "",
    minRate: "",
    maxRate: "",
    notes: "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch("/api/projects").then((r) => r.json()),
      fetch("/api/statuses").then((r) => r.json()),
      fetch("/api/rate").then((r) => r.json()),
      fetch("/api/tasks").then((r) => r.json()),
    ])
      .then(([p, s, r, t]: [Project[], Status[], { rate: number }, Task[]]) => {
        setProjects(p);
        setStatuses(s);
        setRate(r.rate ?? 0);
        const next = (t[0]?.taskNumber ?? 0) + 1;
        setNextNumber(next);
        const def = s.find((x) => x.isDefault);
        setForm((f) => ({
          ...f,
          taskNumber: f.taskNumber || String(next),
          statusId: f.statusId || def?.id || "",
          projectId: f.projectId || p[0]?.id || "",
          minRate: f.minRate || String(p[0]?.minRate ?? ""),
          maxRate: f.maxRate || String(p[0]?.maxRate ?? ""),
        }));
      })
      .catch(() => {});
  }, [open]);

  const minutes = Number(form.minutes || 0);
  const minRate = Number(form.minRate || 0);
  const maxRate = Number(form.maxRate || 0);
  const usd = useMemo(
    () => projectedUsd(minutes, minRate, maxRate),
    [minutes, minRate, maxRate]
  );

  if (!open) return null;

  function setProject(id: string) {
    const p = projects.find((x) => x.id === id);
    setForm((f) => ({
      ...f,
      projectId: id,
      minRate: p ? String(p.minRate) : f.minRate,
      maxRate: p ? String(p.maxRate) : f.maxRate,
    }));
  }

  async function create() {
    if (!form.projectId) {
      setError("Pick a project (create one on the Projects page if empty)");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: form.projectId,
        taskNumber: Number(form.taskNumber) || undefined,
        taskUuid: form.taskUuid,
        stageUuid: form.stageUuid,
        approvalStatus: form.approvalStatus,
        reviewerComment: form.reviewerComment,
        timeSpentMinutes: minutes,
        statusId: form.statusId,
        startAt: form.startAt ? new Date(form.startAt).toISOString() : null,
        endAt: form.endAt ? new Date(form.endAt).toISOString() : null,
        minRate: minRate,
        maxRate: maxRate,
        notes: form.notes,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Failed to create task");
      return;
    }
    setForm({
      projectId: form.projectId,
      taskNumber: String((nextNumber ?? 0) + 1),
      taskUuid: "",
      stageUuid: "",
      approvalStatus: "pending",
      reviewerComment: "",
      minutes: "",
      statusId: statuses.find((s) => s.isDefault)?.id ?? "",
      startAt: "",
      endAt: "",
      minRate: form.minRate,
      maxRate: form.maxRate,
      notes: "",
    });
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-10 overflow-y-auto text-foreground">
      <div className="card w-full max-w-xl overflow-hidden">
        <div className="bg-header text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5 font-semibold">
            <span className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-lg leading-none">
              +
            </span>
            Log New Annotation Task
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
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-emerald-700/80 pointer-events-none">
                  Task
                </span>
                <input
                  type="number"
                  min="1"
                  className="field bg-emerald-50/60 border-emerald-200 font-semibold field-tasknum"
                  value={form.taskNumber || nextNumber || ""}
                  onChange={(e) => setForm({ ...form, taskNumber: e.target.value })}
                  placeholder={nextNumber ? String(nextNumber) : "…"}
                />
              </div>
            </div>
            <div>
              <label className="label block mb-1.5">Project</label>
              <select
                className="field"
                value={form.projectId}
                onChange={(e) => setProject(e.target.value)}
              >
                <option value="">Select project…</option>
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
                value={form.taskUuid}
                onChange={(e) => setForm({ ...form, taskUuid: e.target.value })}
                placeholder="32f78edc-7ed6-421d-…"
              />
            </div>
            <div>
              <label className="label block mb-1.5">Stage UUID</label>
              <input
                className="field font-mono text-xs"
                value={form.stageUuid}
                onChange={(e) => setForm({ ...form, stageUuid: e.target.value })}
                placeholder="30692a50-9c55-4823-…"
              />
            </div>
          </div>

          <div>
            <label className="label block mb-1.5">Approval Status</label>
            <select
              className="field"
              value={form.approvalStatus}
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
              value={form.reviewerComment}
              onChange={(e) => setForm({ ...form, reviewerComment: e.target.value })}
              placeholder="e.g. Approved with bonus for high fidelity, comprehensive reasoning steps, and strict constraint adherence…"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label block mb-1.5">Time (Minutes)</label>
              <input
                type="number"
                min="0"
                className="field"
                value={form.minutes}
                onChange={(e) => setForm({ ...form, minutes: e.target.value })}
                placeholder="e.g. 147"
              />
              <p className="text-[0.7rem] text-muted mt-1">
                {formatHoursHint(minutes)}
              </p>
            </div>
            <div>
              <label className="label block mb-1.5">Stage Status</label>
              <div className="flex flex-wrap gap-1.5">
                {statuses.map((s) => {
                  const active = form.statusId === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setForm({ ...form, statusId: s.id })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        active
                          ? "text-white border-transparent"
                          : "bg-surface text-muted border-line hover:border-primary/50"
                      }`}
                      style={active ? { backgroundColor: s.color } : undefined}
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
                value={form.startAt}
                onChange={(e) => setForm({ ...form, startAt: e.target.value })}
              />
            </div>
            <div>
              <label className="label block mb-1.5">End Date & Time</label>
              <input
                type="datetime-local"
                className="field"
                value={form.endAt}
                onChange={(e) => setForm({ ...form, endAt: e.target.value })}
              />
            </div>
          </div>

          <div className="rounded-xl border border-line bg-slate-50/60 p-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label block mb-1.5 text-xs">Min Rate ($/hr)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    className="field field-currency"
                    value={form.minRate}
                    onChange={(e) => setForm({ ...form, minRate: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="label block mb-1.5 text-xs">Max Rate ($/hr - Accepted)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    className="field field-currency"
                    value={form.maxRate}
                    onChange={(e) => setForm({ ...form, maxRate: e.target.value })}
                  />
                </div>
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
            <div className="text-right">
              <p className="text-[0.65rem] font-bold text-emerald-700/80 uppercase tracking-wide">
                {rate > 0 ? `INR Conversion (@${formatRateINR(rate)})` : "INR Conversion"}
              </p>
              <p className="font-bold text-emerald-800 text-lg">
                {rate > 0 ? inrRangeText(usd.min * rate, usd.max * rate) : "₹0 – ₹0"}
              </p>
            </div>
          </div>

          <div>
            <label className="label block mb-1.5">Notes / Instructions</label>
            <textarea
              className="field"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g. Challenging context, dual turn, verified 2 pm…"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end items-center gap-3 pt-2">
            <button className="btn-ghost px-4 py-2 text-sm" onClick={onClose}>
              Cancel
            </button>
            <button
              className="px-5 py-2 text-sm rounded-[0.6rem] font-semibold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors"
              onClick={create}
              disabled={saving}
            >
              {saving ? "Adding…" : "Add Task"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
