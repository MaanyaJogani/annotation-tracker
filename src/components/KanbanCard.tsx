"use client";

import { storedMinutes } from "@/lib/focus-timer";
import { useId, useState } from "react";
import type { Task } from "@/lib/types";
import { formatDateTime, formatMinutesChip } from "@/lib/format";
import { projectedUsd } from "@/lib/payout";
import ExpandableText from "@/components/ExpandableText";
import EstimatedPay from "@/components/EstimatedPay";
import CopyField from "@/components/CopyField";

interface Props {
  task: Task;
  rate: number;
  onEdit: (t: Task) => void;
  onDelete: (t: Task) => void;
  onSetStatus: (t: Task, statusName: string) => void;
  onSetApproval: (t: Task, approval: string) => void;
  onUpdateNotes: (t: Task, value: string) => void;
  onUpdateComment: (t: Task, value: string) => void;
}

/** Inline editable text — click the placeholder/value to turn into an input, blur to save. */
function InlineField({
  icon,
  placeholder,
  label,
  value,
  multiline,
  italic,
  onSave,
}: {
  icon: React.ReactNode;
  placeholder: string;
  label?: string;
  value: string;
  multiline?: boolean;
  italic?: boolean;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (editing) {
    const Field = multiline ? "textarea" : "input";
    return (
      <Field
        autoFocus
        rows={multiline ? 2 : undefined}
        aria-label={label || placeholder}
        className="field min-h-24 text-sm"
        value={draft}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft !== value) onSave(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !multiline) e.currentTarget.blur();
          if (e.key === "Escape") {
            setDraft(value);
            setEditing(false);
          }
        }}
      />
    );
  }

  if (!value) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          setDraft("");
          setEditing(true);
        }}
        className="task-note-action"
      >
        {icon}
        {placeholder}
        <span aria-hidden="true" className="ml-auto text-xl text-slate-400">›</span>
      </button>
    );
  }

  return (
    <div className="task-notes py-4">
      <div className="flex items-center justify-between gap-2">
        {label && (
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            {icon}
            {label}
          </p>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setDraft(value);
            setEditing(true);
          }}
          aria-label={`Edit ${label || "text"}`}
          className="task-icon-button ml-auto"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </button>
      </div>
      <ExpandableText text={italic ? `"${value}"` : value} label={(label || "text").toLowerCase()} className={`text-sm text-slate-600 mt-2 ${italic ? "italic" : ""}`} />
    </div>
  );
}

export default function KanbanCard({
  task,
  rate,
  onEdit,
  onDelete,
  onSetStatus,
  onSetApproval,
  onUpdateNotes,
  onUpdateComment,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const detailsId = useId();
  const detailSections = ["review", "ids", "dates", "notes", "actions"];
  const usd = projectedUsd(storedMinutes(task), task.minRate, task.taskType === "review" ? task.minRate : task.maxRate);
  const running = task.timerStartedAt !== null;
  const group = task.statusKanbanGroup;
  const isPaid = group === "paid";
  const approval = {
    pending: { label: "Pending Review", basis: "Estimated range", icon: "◷" },
    accepted: { label: "Accepted", basis: "Maximum rate", icon: "✓" },
    rejected: { label: "Rejected", basis: "Minimum rate", icon: "×" },
  }[task.approvalStatus];

  return (
    <div className="card task-card" data-approval={task.taskType === "review" ? undefined : task.approvalStatus} data-paid={isPaid}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold text-2xl tracking-tight text-slate-950">{task.name}</h3>
        <span title={`${task.timeSpentMinutes} total minutes`} className="task-duration inline-flex shrink-0 whitespace-nowrap items-center justify-end gap-1.5 rounded-xl px-3 py-2 text-sm text-slate-600">
          <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
          </svg>
          <span className="font-bold">{formatMinutesChip(task.timeSpentMinutes).split(" (")[0]}</span>
          <span className="text-slate-400 font-medium">
            ({task.timeSpentMinutes}m)
          </span>
        </span>
      </div>

      <div className="task-project flex flex-wrap items-center gap-3 text-sm">
        <span className="inline-flex items-center gap-2 rounded-md bg-emerald-50 px-2.5 py-1 text-sm font-semibold text-emerald-900">
          <svg aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 8 0 9 9 5 9-5V8M12 13v9" />
          </svg>
          {task.projectName}
        </span>
        <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-semibold ${task.taskType === "review" ? "border-violet-200 bg-violet-50 text-violet-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
          {task.taskType === "review" ? "Review" : "Annotation"}
        </span>
        <span hidden={!expanded} className="text-muted">
          {task.taskType === "review" ? `$${task.minRate} / hr` : `$${task.minRate} – $${task.maxRate} / hr`}
        </span>
        <span hidden={expanded || task.taskType === "review"} className="task-approval-badge ml-auto">
          <span aria-hidden="true" className="text-base leading-none">{approval.icon}</span>
          {approval.label}
        </span>
      </div>

      <div id={`${detailsId}-review`} hidden={!expanded || task.taskType === "review"} className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-slate-500">Review status</p>
        <select
          aria-label="Review status"
          value={task.approvalStatus}
          onChange={(e) => onSetApproval(task, e.target.value)}
          className={`rounded-lg border text-sm font-semibold py-2 pl-3 pr-2 cursor-pointer max-w-full ${
            task.approvalStatus === "accepted"
              ? "bg-emerald-100 text-emerald-900 border-emerald-300"
              : task.approvalStatus === "rejected"
                ? "bg-rose-100 text-rose-900 border-rose-300"
                : "bg-amber-100 text-amber-900 border-amber-300"
          }`}
        >
          <option value="pending">Pending Review</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <div id={`${detailsId}-ids`} hidden={!expanded} className="task-id-panel divide-y divide-slate-200">
        <CopyField label={task.taskType === "review" ? "Session ID" : "Task ID"} value={task.taskUuid} />
        <CopyField label={task.taskType === "review" ? "Pair ID" : "Stage ID"} value={task.stageUuid} />
      </div>

      <div id={`${detailsId}-dates`} hidden={!expanded} className="task-dates grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="flex items-center gap-2 text-slate-500 font-medium text-sm">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 11h18" />
            </svg>
            Started
          </p>
          <p className="text-slate-700 font-medium mt-0.5">{formatDateTime(task.startAt)}</p>
        </div>
        <div className="min-w-0 border-l border-slate-200 pl-4">
          <p className="flex items-center gap-2 text-slate-500 font-medium text-sm">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 11h18" />
            </svg>
            Ended
          </p>
          <p className={`font-medium mt-0.5 ${running ? "text-amber-600 italic" : "text-slate-700"}`}>
            {running ? "Ongoing" : formatDateTime(task.endAt)}
          </p>
        </div>
      </div>

      <EstimatedPay basisLabel={task.taskType === "review" ? undefined : approval.basis} approvalStatus={task.approvalStatus} usd={usd} rate={rate} paid={isPaid} />

      {task.taskType === "review" && <div hidden={!expanded} className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-3 text-sm space-y-3">
        <p><span className="font-semibold">Reviewed worker: </span>{task.reviewWorkerEmail || "Not entered"}</p>
        <div>
          <p className="font-semibold">Justification</p>
          <ExpandableText text={task.reviewJustification || "Not entered"} label="justification" className="text-slate-600" />
        </div>
        <div>
          <p className="font-semibold">Tasker feedback</p>
          <ExpandableText text={task.taskerFeedback || "Not entered"} label="feedback" className="text-slate-600" />
        </div>
      </div>}

      <div id={`${detailsId}-notes`} hidden={!expanded} className="task-note-fields divide-y divide-slate-200">
        {task.taskType !== "review" && (
        <InlineField
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          }
          label="Reviewer comment"
          placeholder="Add reviewer comment"
          value={task.reviewerComment}
          multiline
          onSave={(v) => onUpdateComment(task, v)}
        />
        )}

        <InlineField
          icon={
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          }
          label="Task Notes"
          placeholder="Add task notes"
          value={task.notes}
          multiline
          italic
          onSave={(v) => onUpdateNotes(task, v)}
        />

      </div>

      {task.taskType === "review" && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">
            <svg aria-hidden="true" className="h-4 w-4 text-indigo-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m12 3 8 4v5c0 5-8 9-8 9s-8-4-8-9V7l8-4Z" /><path d="m8 12 3 3 5-6" /></svg>
            Tasker decision:
          </span>
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-bold ${task.taskerDecision === "pass" ? "border-emerald-300 bg-emerald-100 text-emerald-800" : task.taskerDecision === "fail" ? "border-rose-300 bg-rose-100 text-rose-700" : "border-slate-200 bg-white text-slate-500"}`}>
            <span aria-hidden="true">{task.taskerDecision === "pass" ? "✓" : task.taskerDecision === "fail" ? "⊗" : "—"}</span>
            {task.taskerDecision === "pass" ? "Pass" : task.taskerDecision === "fail" ? "Fail" : "Unselected"}
          </span>
        </div>
      )}

      <div id={`${detailsId}-actions`} hidden={!expanded} className="task-card-footer">
        {group === "in_progress" && (
          <button
            onClick={() => onSetStatus(task, "Completed")}
            className="task-primary-action"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            Mark Completed
          </button>
        )}

        {group === "completed" && (
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <button
              onClick={() => onSetStatus(task, "Paid & Closed")}
              className="task-primary-action task-paid-action"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M20.59 13.41 12 22l-9-9V4a1 1 0 0 1 1-1h9l7.59 7.59a2 2 0 0 1 0 2.82z" />
                <circle cx="7.5" cy="7.5" r="1" fill="currentColor" stroke="none" />
              </svg>
              Move to Paid →
            </button>
            <button
              title="Move back to In Progress"
              onClick={() => onSetStatus(task, "In Progress")}
              className="task-icon-button"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" />
              </svg>
            </button>
          </div>
        )}

        {isPaid && (
          <button
            onClick={() => onSetStatus(task, "Completed")}
            className="task-primary-action task-return-action"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" />
            </svg>
            Return to Completed
          </button>
        )}

        <div className="flex items-center gap-1">
          <button
            title="Edit task"
            onClick={() => onEdit(task)}
            className="task-icon-button"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>
          <button
            title="Delete task"
            onClick={() => onDelete(task)}
            className="task-icon-button task-delete-button"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 6h18M8 6V4h8v2m-9 0v14h10V6" />
            </svg>
          </button>
        </div>
      </div>
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailSections.map((section) => `${detailsId}-${section}`).join(" ")}
        aria-label={`${expanded ? "Collapse" : "Expand"} ${task.name}`}
        onClick={() => setExpanded((value) => !value)}
        className="task-expand-button"
      >
        {expanded ? "Show less" : "Show details"}
        <svg aria-hidden="true" className={`h-4 w-4 ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </div>
  );
}
