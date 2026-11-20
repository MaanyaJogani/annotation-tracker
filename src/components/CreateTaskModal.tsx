"use client";

import { useEffect, useMemo, useState } from "react";
import { ReviewFields, ReviewDecision } from "@/components/ReviewFields";
import DateTimePicker from "@/components/DateTimePicker";
import StageStatusSelect from "@/components/StageStatusSelect";
import EstimatedPay from "@/components/EstimatedPay";
import type { Project, Status, Task } from "@/lib/types";
import { formatHoursHint } from "@/lib/format";
import { projectedUsd } from "@/lib/payout";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateTaskModal({ open, onClose, onCreated }: Props) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [rate, setRate] = useState(0);
  const [nextNumbers, setNextNumbers] = useState({ annotation: 1, review: 1 });
  const [nameEdited, setNameEdited] = useState(false);
  const [form, setForm] = useState({
    projectId: "",
    name: "",
    taskType: "annotation",
    taskUuid: "",
    stageUuid: "",
    approvalStatus: "pending",
    reviewerComment: "",
    reviewWorkerEmail: "", reviewJustification: "", taskerFeedback: "", taskerDecision: "",
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
    let active = true;
    fetch("/api/projects")
      .then(async response => {
        if (!response.ok) throw new Error();
        const rows: Project[] = await response.json();
        if (!active) return;
        const newest = rows[0];
        setProjects(rows);
        setForm(f => ({ ...f, projectId: newest?.id ?? "",
          minRate: String(newest?.minRate ?? ""), maxRate: String(newest?.maxRate ?? "") }));
      })
      .catch(() => { if (active) setError("Could not load projects. Reopen the form to retry."); });
    return () => { active = false; setProjects(null); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    Promise.all([
      fetch("/api/statuses").then((r) => r.json()),
      fetch("/api/rate").then((r) => r.json()),
      fetch("/api/tasks").then((r) => r.json()),
    ])
      .then(([s, r, t]: [Status[], { rate: number }, Task[]]) => {
        setStatuses(s);
        setRate(r.rate ?? 0);
        const numbers = { annotation: Math.max(0, ...t.filter(x => x.taskType !== "review").map(x => x.typeNumber)) + 1, review: Math.max(0, ...t.filter(x => x.taskType === "review").map(x => x.typeNumber)) + 1 };
        setNextNumbers(numbers);
        const def = s.find((x) => x.isDefault);
        setForm((f) => ({
          ...f,
          name: nameEdited ? f.name : `${f.taskType === "review" ? "Review" : "Task"} ${numbers[f.taskType as "annotation" | "review"]}`,
          statusId: f.statusId || def?.id || "",
        }));
      })
      .catch(() => {});
  // Preserve edits while the dialog is open.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const minutes = Number(form.minutes || 0);
  const minRate = Number(form.minRate || 0);
  const maxRate = form.taskType === "review" ? minRate : Number(form.maxRate || 0);
  const usd = useMemo(
    () => projectedUsd(minutes, minRate, maxRate),
    [minutes, minRate, maxRate]
  );

  if (!open) return null;

  function setProject(id: string) {
    const p = projects?.find((x) => x.id === id);
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
        name: nameEdited ? form.name : undefined,
        taskType: form.taskType,
        taskUuid: form.taskUuid,
        stageUuid: form.stageUuid,
        approvalStatus: form.approvalStatus,
        reviewerComment: form.reviewerComment,
        reviewWorkerEmail: form.reviewWorkerEmail, reviewJustification: form.reviewJustification, taskerFeedback: form.taskerFeedback, taskerDecision: form.taskerDecision || null,
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
      name: "",
      taskType: form.taskType,
      taskUuid: "",
      stageUuid: "",
      approvalStatus: "pending",
      reviewerComment: "",
    reviewWorkerEmail: "", reviewJustification: "", taskerFeedback: "", taskerDecision: "",
      minutes: "",
      statusId: statuses.find((s) => s.isDefault)?.id ?? "",
      startAt: "",
      endAt: "",
      minRate: form.minRate,
      maxRate: form.maxRate,
      notes: "",
    });
    setNameEdited(false);
    onCreated();
    onClose();
  }

  return (
    <div className="create-task-overlay fixed inset-0 z-50 bg-black/50 text-foreground">
      <div role="dialog" aria-modal="true" aria-labelledby="new-task-title" className="card create-task-dialog">
        <div className="bg-header text-white px-6 py-4 flex shrink-0 items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 font-semibold">
            <span className="w-7 h-7 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-lg leading-none">
              +
            </span>
            <h2 id="new-task-title">Log New Task</h2>
          </div>
          <button aria-label="Close new task" onClick={onClose} className="text-white/70 hover:text-white text-lg leading-none p-2 rounded-lg hover:bg-white/10">
            ✕
          </button>
        </div>

        <div className="create-task-body">
          <div className="create-task-main">
            <section className="create-task-section" aria-labelledby="new-task-details-heading">
              <div className="create-task-section-heading">
                <h3 id="new-task-details-heading">Task details</h3>
                <p>Choose a project and identify the task.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="label">Task type
                  <select className="field mt-1.5" value={form.taskType} onChange={(e) => { const type = e.target.value as "annotation" | "review"; setForm({ ...form, taskType: type, name: nameEdited ? form.name : `${type === "review" ? "Review" : "Task"} ${nextNumbers[type]}` }); }}>
                    <option value="annotation">Annotation</option><option value="review">Review</option>
                  </select>
                </label>
                <label className="label">{form.taskType === "review" ? "Review Name / Ticket" : "Task name"}
                  <input className="field mt-1.5" maxLength={200} value={form.name} onChange={(e) => { setNameEdited(true); setForm({ ...form, name: e.target.value }); }} placeholder="Leave blank for an automatic name" />
                </label>
                <div>
                  <label htmlFor="new-task-field-2" className="label block mb-1.5">Project</label>
                  <select id="new-task-field-2"
                    className="field"
                    disabled={!projects}
                    value={projects ? form.projectId : ""}
                    onChange={(e) => setProject(e.target.value)}
                  >
                    <option value="">Select project…</option>
                    {projects?.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="new-task-field-3" className="label block mb-1.5">{form.taskType === "review" ? "Session ID" : "Task UUID"}</label>
                  <input id="new-task-field-3"
                    className="field font-mono text-xs"
                    value={form.taskUuid}
                    onChange={(e) => setForm({ ...form, taskUuid: e.target.value })}
                    placeholder="32f78edc-7ed6-421d-…"
                  />
                </div>
                <div>
                  <label htmlFor="new-task-field-4" className="label block mb-1.5">{form.taskType === "review" ? "Pair ID" : "Stage UUID"}</label>
                  <input id="new-task-field-4"
                    className="field font-mono text-xs"
                    value={form.stageUuid}
                    onChange={(e) => setForm({ ...form, stageUuid: e.target.value })}
                    placeholder="30692a50-9c55-4823-…"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="new-task-field-5" className="label block mb-1.5">Notes / Instructions</label>
                <textarea id="new-task-field-5"
                  className="field"
                  rows={2}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="e.g. Challenging context, dual turn, verified 2 pm…"
                />
              </div>

            </section>
            {form.taskType === "review" && <ReviewFields workerEmail={String(form.reviewWorkerEmail ?? "")} justification={String(form.reviewJustification ?? "")} feedback={String(form.taskerFeedback ?? "")} onChange={(key, value) => setForm({ ...form, [key]: value })} />}
            {form.taskType !== "review" && (
            <section className="create-task-section" aria-labelledby="new-task-review-heading">
              <div className="create-task-section-heading">
                <h3 id="new-task-review-heading">{form.taskType === "review" ? "Your task approval" : "Review"}</h3>
                <p>Track approval and feedback for your own work.</p>
              </div>
              <div>
                <label htmlFor="new-task-field-6" className="label block mb-1.5">Approval Status</label>
                <select id="new-task-field-6"
                  className="field approval-status-select font-semibold transition-colors"
                  data-approval={form.approvalStatus}
                  value={form.approvalStatus}
                  onChange={(e) => setForm({ ...form, approvalStatus: e.target.value })}
                >
                  <option value="pending">Pending Review</option>
                  <option value="accepted">Accepted</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              <div>
                <label htmlFor="new-task-field-7" className="label flex items-baseline justify-between mb-1.5">
                  <span>Reviewer&apos;s Comment</span>
                </label>
                <textarea id="new-task-field-7"
                  className="field"
                  rows={2}
                  value={form.reviewerComment}
                  onChange={(e) => setForm({ ...form, reviewerComment: e.target.value })}
                  placeholder="e.g. Approved with bonus for high fidelity, comprehensive reasoning steps, and strict constraint adherence…"
                />
              </div>

            </section>
            )}
          </div>
          <div className="create-task-sidebar">
            <section className="create-task-section" aria-labelledby="new-task-time-heading">
              <div className="create-task-section-heading">
                <h3 id="new-task-time-heading">Time & progress</h3>
                <p>Set the stage and record time worked.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="new-task-field-8" className="label block mb-1.5">Time (Minutes)</label>
                  <input id="new-task-field-8"
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
                  <StageStatusSelect
                    statuses={statuses}
                    value={String(form.statusId ?? "")}
                    onChange={(statusId) => setForm({ ...form, statusId })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="new-task-start" className="label block mb-1.5">Start Date & Time</label>
                  <DateTimePicker id="new-task-start"
                    label="Start Date & Time"
                    value={form.startAt}
                    onChange={(value) => setForm({ ...form, startAt: value })}
                  />
                </div>
                <div>
                  <label htmlFor="new-task-field-9" className="label block mb-1.5">End Date & Time</label>
                  <DateTimePicker id="new-task-field-9"
                    label="End Date & Time"
                    value={form.endAt}
                    onChange={(value) => setForm({ ...form, endAt: value })}
                  />
                </div>
              </div>

            </section>
            <section className="create-task-section" aria-labelledby="new-task-pay-heading">
              <div className="create-task-section-heading">
                <h3 id="new-task-pay-heading">Rates & estimated pay</h3>
                <p>Rates follow the project and can be adjusted.</p>
              </div>
              <div className="rounded-xl border border-line bg-slate-50/60 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="new-task-field-10" className="label block mb-1.5 text-xs">{form.taskType === "review" ? "Hourly Rate ($/hr)" : "Min Rate ($/hr)"}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
                      <input id="new-task-field-10"
                        type="number"
                        min="0"
                        step="0.5"
                        className="field field-currency"
                        value={form.minRate}
                        onChange={(e) => setForm({ ...form, minRate: e.target.value })}
                      />
                    </div>
                  </div>
                  <div hidden={form.taskType === "review"}>
                    <label htmlFor="new-task-field-11" className="label block mb-1.5 text-xs">{form.taskType === "review" ? "Max Rate ($/hr)" : "Max Rate ($/hr - Accepted)"}</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">$</span>
                      <input id="new-task-field-11"
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

              <EstimatedPay approvalStatus={form.approvalStatus} usd={usd} rate={rate} showRate />
            </section>
            {form.taskType === "review" && <ReviewDecision value={String(form.taskerDecision ?? "")} onChange={value => setForm({ ...form, taskerDecision: value })} />}
          </div>
        </div>
        <div className="create-task-footer">
          {error && <p role="alert" className="text-sm text-red-600 mr-auto">{error}</p>}
              <div className="flex justify-end items-center gap-3 ml-auto">
                <button className="btn-ghost px-4 py-2 text-sm" onClick={onClose}>
                  Cancel
                </button>
                <button
                  className="px-5 py-2 text-sm rounded-[0.6rem] font-semibold bg-emerald-700 text-white hover:bg-emerald-800 transition-colors"
                  onClick={create}
                  disabled={saving || !projects}
                >
                  {saving ? "Adding…" : "Add Task"}
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
