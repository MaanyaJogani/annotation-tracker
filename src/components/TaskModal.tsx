"use client";

import { useEffect, useRef, useState } from "react";
import { ReviewFields, ReviewDecision } from "@/components/ReviewFields";
import DateTimePicker from "@/components/DateTimePicker";
import StageStatusSelect from "@/components/StageStatusSelect";
import EstimatedPay from "@/components/EstimatedPay";
import type { Project, Status, Task } from "@/lib/types";
import {
  formatHoursHint,
  fromDateInputValue,
  toDateInputValue,
} from "@/lib/format";
import { canAssignPayoutWeek, projectedUsd } from "@/lib/payout";

interface Props {
  task: Task | null;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export default function TaskModal({ task, open, onClose, onSaved }: Props) {
  const [weeks, setWeeks] = useState<{id: string; weekNumber: number; paidOn: string | null}[]>([]);
  const [weekError, setWeekError] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    fetch("/api/payouts").then(async response => {
      if (!response.ok) throw new Error();
      const rows = await response.json();
      if (active) { setWeeks(rows); setWeekError(false); }
    }).catch(() => { if (active) setWeekError(true); });
    return () => { active = false; };
  }, [open]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [rate, setRate] = useState(0);
  const [form, setForm] = useState<Record<string, string | number | null>>({});
  const original = useRef<typeof form>({});
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
    original.current = {
      payoutId: task.payoutId ?? null,
      name: task.name,
      taskType: task.taskType ?? "annotation",
      projectId: task.projectId,
      taskUuid: task.taskUuid,
      stageUuid: task.stageUuid,
      approvalStatus: task.approvalStatus,
      reviewerComment: task.reviewerComment,
      reviewWorkerEmail: task.reviewWorkerEmail ?? "", reviewJustification: task.reviewJustification ?? "", taskerFeedback: task.taskerFeedback ?? "", taskerDecision: task.taskerDecision ?? "",
      timeSpentMinutes: task.timeSpentMinutes,
      statusId: task.statusId,
      startAt: toDateInputValue(task.startAt),
      endAt: toDateInputValue(task.endAt),
      minRate: task.minRate,
      maxRate: task.maxRate,
      notes: task.notes,
    };
    setForm(original.current);
    setError("");
  }, [task, open]);

  if (!open || !task) return null;

  const stage = statuses.find(status => status.id === form.statusId)?.kanbanGroup;
  const showPayoutWeek = canAssignPayoutWeek(stage ?? (form.statusId === task.statusId ? task.statusKanbanGroup : null));
  const minutes = Number(form.timeSpentMinutes ?? 0);
  const minRate = Number(form.minRate ?? 0);
  const maxRate = form.taskType === "review" ? minRate : Number(form.maxRate ?? 0);
  const usd = projectedUsd(minutes, minRate, maxRate);

  async function save() {
    setSaving(true);
    setError("");
    const payload: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(form)) {
      if (value === original.current[key]) continue;
      if (key === "payoutId" && !showPayoutWeek) continue;
      if (key === "startAt" || key === "endAt") payload[key] = fromDateInputValue(String(value ?? ""));
      else if (key === "taskerDecision") payload[key] = value || null;
      else payload[key] = value;
    }
    try {
      const res = await fetch(`/api/tasks/${task!.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed to save");
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Failed to save");
      return;
    } finally {
      setSaving(false);
    }
    onSaved();
    onClose();
  }

  return (
    <div className="create-task-overlay fixed inset-0 z-50 bg-black/50 text-foreground">
      <div role="dialog" aria-modal="true" aria-labelledby="edit-task-title" className="card create-task-dialog">
        <div className="bg-header text-white px-6 py-4 flex shrink-0 items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-semibold">
            <span className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-sm">
              ✎
            </span>
            <h2 id="edit-task-title">Edit Task</h2>
          </div>
          <button aria-label="Close edit task" onClick={onClose} className="text-white/70 hover:text-white text-lg leading-none p-2 rounded-lg hover:bg-white/10">
            ✕
          </button>
        </div>

        <div className="create-task-body">
          <div className="create-task-main">
            <section className="create-task-section" aria-labelledby="edit-task-details-heading">
              <div className="create-task-section-heading">
                <h3 id="edit-task-details-heading">Task details</h3>
                <p>Update the project and task information.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                <label className="label">Task type
                  <select className="field mt-1.5" value={String(form.taskType ?? "annotation")} onChange={(e) => setForm({ ...form, taskType: e.target.value })}>
                    <option value="annotation">Annotation</option><option value="review">Review</option>
                  </select>
                </label>
                <label className="label">{form.taskType === "review" ? "Review Name / Ticket" : "Task name"}
                  <input className="field mt-1.5" maxLength={200} value={String(form.name ?? "")} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Leave blank for an automatic name" />
                </label>
                <div>
                  <label htmlFor="edit-task-field-2" className="label block mb-1.5">Project</label>
                  <select id="edit-task-field-2"
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-task-field-3" className="label block mb-1.5">{form.taskType === "review" ? "Session ID" : "Task UUID"}</label>
                  <input id="edit-task-field-3"
                    className="field font-mono text-xs"
                    value={String(form.taskUuid ?? "")}
                    onChange={(e) => setForm({ ...form, taskUuid: e.target.value })}
                  />
                </div>
                <div>
                  <label htmlFor="edit-task-field-4" className="label block mb-1.5">{form.taskType === "review" ? "Pair ID" : "Stage UUID"}</label>
                  <input id="edit-task-field-4"
                    className="field font-mono text-xs"
                    value={String(form.stageUuid ?? "")}
                    onChange={(e) => setForm({ ...form, stageUuid: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="edit-task-field-12" className="label block mb-1.5">Notes / Instructions</label>
                <textarea id="edit-task-field-12"
                  className="field"
                  rows={2}
                  value={String(form.notes ?? "")}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
            </section>
            {form.taskType === "review" && <ReviewFields workerEmail={String(form.reviewWorkerEmail ?? "")} justification={String(form.reviewJustification ?? "")} feedback={String(form.taskerFeedback ?? "")} onChange={(key, value) => setForm({ ...form, [key]: value })} />}
            {form.taskType !== "review" && (
            <section className="create-task-section" aria-labelledby="edit-task-review-heading">
              <div className="create-task-section-heading">
                <h3 id="edit-task-review-heading">{form.taskType === "review" ? "Your task approval" : "Review"}</h3>
                <p>Track approval and feedback for your own work.</p>
              </div>
              <div>
                <label htmlFor="edit-task-field-5" className="label block mb-1.5">Approval Status</label>
                <select id="edit-task-field-5"
                  className="field approval-status-select font-semibold transition-colors"
                  data-approval={String(form.approvalStatus ?? "pending")}
                  value={String(form.approvalStatus ?? "pending")}
                  onChange={(e) => setForm({ ...form, approvalStatus: e.target.value })}
                >
                  <option value="pending">Pending Review</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label htmlFor="edit-task-field-6" className="label flex items-baseline justify-between mb-1.5">
                  <span>Reviewer&apos;s Comment</span>
                </label>
                <textarea id="edit-task-field-6"
                  className="field"
                  rows={2}
                  value={String(form.reviewerComment ?? "")}
                  onChange={(e) => setForm({ ...form, reviewerComment: e.target.value })}
                  placeholder="e.g. Approved with bonus for high fidelity…"
                />
              </div>
            </section>
            )}
          </div>
          <div className="create-task-sidebar">
            <section className="create-task-section" aria-labelledby="edit-task-time-heading">
              <div className="create-task-section-heading">
                <h3 id="edit-task-time-heading">Time & progress</h3>
                <p>Set the stage and record time worked.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-task-field-7" className="label block mb-1.5">Time (Minutes)</label>
                  <input id="edit-task-field-7"
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
                  <StageStatusSelect
                    statuses={statuses}
                    value={String(form.statusId ?? "")}
                    onChange={(statusId) => setForm({ ...form, statusId })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="edit-task-field-8" className="label block mb-1.5">Start Date & Time</label>
                  <DateTimePicker id="edit-task-field-8"
                    label="Start Date & Time"
                    value={String(form.startAt ?? "")}
                    onChange={(value) => setForm({ ...form, startAt: value })}
                  />
                </div>
                <div>
                  <label htmlFor="edit-task-field-9" className="label block mb-1.5">End Date & Time</label>
                  <DateTimePicker id="edit-task-field-9"
                    label="End Date & Time"
                    value={String(form.endAt ?? "")}
                    onChange={(value) => setForm({ ...form, endAt: value })}
                  />
                </div>
              </div>
            </section>
            <section className="create-task-section" aria-labelledby="edit-task-pay-heading">
              <div className="create-task-section-heading">
                <h3 id="edit-task-pay-heading">Rates & estimated pay</h3>
                <p>Adjust this task’s rates and preview its payout.</p>
              </div>
              <div className="rounded-xl border border-line bg-slate-50/60 p-4">
                <p className="label mb-2.5">{form.taskType === "review" ? "Review rate" : "Hourly Rates ($/hr)"}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="edit-task-field-10" className="label block mb-1.5 text-xs">{form.taskType === "review" ? "Hourly Rate ($/hr)" : "Min Rate ($/hr)"}</label>
                    <input id="edit-task-field-10"
                      type="number"
                      min="0"
                      step="0.5"
                      className="field"
                      value={minRate}
                      onChange={(e) => setForm({ ...form, minRate: Number(e.target.value) })}
                    />
                  </div>
                  <div hidden={form.taskType === "review"}>
                    <label htmlFor="edit-task-field-11" className="label block mb-1.5 text-xs">Max Rate ($/hr – Accepted)</label>
                    <input id="edit-task-field-11"
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

              <EstimatedPay approvalStatus={String(form.approvalStatus ?? "pending")} usd={usd} rate={rate} showRate />
            </section>
            {form.taskType === "review" && <ReviewDecision value={String(form.taskerDecision ?? "")} onChange={value => setForm({ ...form, taskerDecision: value })} />}
            {showPayoutWeek && <section className="create-task-section">
                <label className="label">Payout week
                  <select className="field mt-1.5" disabled={weekError} value={String(form.payoutId ?? "")} onChange={e => setForm({...form, payoutId: e.target.value || null})}>
                    <option value="">Unassigned</option>
                    {weeks.map(week => <option key={week.id} value={week.id}>Week {week.weekNumber}{week.paidOn && ` · ${week.paidOn}`}</option>)}
                  </select>
                  {weekError && <span role="alert">Could not load payout weeks.</span>}
                </label>
            </section>}
          </div>
        </div>
        <div className="create-task-footer">
          {error && <p role="alert" className="text-sm text-red-600 mr-auto">{error}</p>}
          <div className="flex justify-end items-center gap-3 ml-auto">
            <button className="btn-ghost px-4 py-2 text-sm" onClick={onClose}>
              Cancel
            </button>
            <button className="px-5 py-2 text-sm rounded-[0.6rem] font-semibold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
