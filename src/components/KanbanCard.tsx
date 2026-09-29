"use client";

import { useState } from "react";
import type { Task } from "@/lib/types";
import { formatDateTime, formatMinutesChip } from "@/lib/format";
import { inrRangeText, projectedUsd, usdRangeText } from "@/lib/payout";
import { copyText } from "@/lib/clipboard";

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

const CopyIcon = ({ copied }: { copied: boolean }) =>
  copied ? (
    <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path d="M5 13l4 4L19 7" />
    </svg>
  ) : (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </svg>
  );

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[0.65rem] font-bold text-muted uppercase tracking-wider">{label}</p>
        <p className="font-mono text-xs text-slate-700 truncate mt-0.5">
          {value || <span className="text-muted italic">not set</span>}
        </p>
      </div>
      <button
        title={copied ? "Copied!" : `Copy ${label.toLowerCase()}`}
        disabled={!value}
        onClick={async (e) => {
          e.stopPropagation();
          if (!value) return;
          const ok = await copyText(value);
          if (ok) {
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }
        }}
        className="shrink-0 text-muted hover:text-primary disabled:opacity-30 disabled:hover:text-muted"
      >
        <CopyIcon copied={copied} />
      </button>
    </div>
  );
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
        className="field text-xs"
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
        className="w-full flex items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2 text-xs text-muted hover:border-primary/40 hover:text-primary transition-colors"
      >
        {icon}
        {placeholder}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-line px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        {label && (
          <p className="text-[0.65rem] font-bold text-muted uppercase tracking-wider flex items-center gap-1.5">
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
          className="shrink-0 text-muted hover:text-primary ml-auto"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </button>
      </div>
      <p className={`text-xs text-slate-600 mt-1 ${italic ? "italic" : ""}`}>
        {italic ? `"${value}"` : value}
      </p>
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
  const usd = projectedUsd(task.timeSpentMinutes, task.minRate, task.maxRate);
  const running = task.timerStartedAt !== null;
  const group = task.statusKanbanGroup;
  const isPaid = group === "paid";

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold text-lg">Task {task.taskNumber}</h3>
        <span className="chip bg-white text-slate-700 border border-line shadow-sm px-2.5 py-1">
          <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
          </svg>
          <span className="font-bold">{formatMinutesChip(task.timeSpentMinutes).split(" (")[0]}</span>
          <span className="text-slate-400 font-medium">
            ({task.timeSpentMinutes}m)
          </span>
        </span>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted">Review Status</p>
        <select
          value={task.approvalStatus}
          onChange={(e) => onSetApproval(task, e.target.value)}
          className={`chip border font-semibold py-1.5 pl-3 pr-2 cursor-pointer ${
            task.approvalStatus === "accepted"
              ? "bg-emerald-100 text-emerald-700 border-emerald-200"
              : task.approvalStatus === "rejected"
                ? "bg-red-100 text-red-700 border-red-200"
                : "bg-amber-100 text-amber-800 border-amber-200"
          }`}
        >
          <option value="pending">Pending Review</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {group === "in_progress" && (
        <button
          onClick={() => onSetStatus(task, "Completed")}
          className="w-full py-2.5 text-sm font-semibold rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          Mark Completed →
        </button>
      )}

      {group === "completed" && (
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onSetStatus(task, "Paid & Closed")}
            className="flex-1 py-2.5 text-sm font-semibold rounded-xl bg-violet-50 text-violet-700 border border-violet-200 hover:bg-violet-100 transition-colors flex items-center justify-center gap-1.5"
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
            className="btn-ghost p-2.5 text-muted"
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
          className="w-full py-2.5 text-sm font-semibold rounded-xl bg-slate-50 text-slate-600 border border-line hover:bg-slate-100 transition-colors flex items-center justify-center gap-1.5"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" />
          </svg>
          Return to Completed
        </button>
      )}

      <div className="rounded-xl border border-line divide-y divide-line">
        <CopyField label="Task ID" value={task.taskUuid} />
        <CopyField label="Stage ID" value={task.stageUuid} />
      </div>

      <div className="rounded-xl bg-slate-50/70 border border-line px-3 py-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <p className="flex items-center gap-1.5 text-emerald-700 font-bold text-[0.65rem] uppercase tracking-wide">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 11h18" />
            </svg>
            Start
          </p>
          <p className="text-slate-700 font-medium mt-0.5">{formatDateTime(task.startAt)}</p>
        </div>
        <div className="text-right">
          <p className="flex items-center justify-end gap-1.5 text-emerald-700 font-bold text-[0.65rem] uppercase tracking-wide">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 11h18" />
            </svg>
            End
          </p>
          <p className={`font-medium mt-0.5 ${running ? "text-amber-600 italic" : "text-slate-700"}`}>
            {running ? "Ongoing" : formatDateTime(task.endAt)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs">
        <div>
          <p className="font-bold text-muted uppercase tracking-wide text-[0.65rem]">
            {isPaid ? "USD Payout" : "Min & Max USD Pay"}
          </p>
          <p className="font-bold text-slate-800 mt-0.5">{usdRangeText(usd.min, usd.max)}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-muted uppercase tracking-wide text-[0.65rem]">
            {isPaid ? "INR Equivalent" : "Min & Max INR Pay"}
          </p>
          <p className="font-bold text-emerald-700 mt-0.5">
            {rate > 0 ? inrRangeText(usd.min * rate, usd.max * rate) : "—"}
          </p>
        </div>
      </div>

      <InlineField
        icon={
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        }
        placeholder="+ Add Reviewer's Comment"
        value={task.reviewerComment}
        multiline
        onSave={(v) => onUpdateComment(task, v)}
      />

      <InlineField
        icon={
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        }
        label="Task Notes"
        placeholder="+ Add Task Notes"
        value={task.notes}
        multiline
        italic
        onSave={(v) => onUpdateNotes(task, v)}
      />

      <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-line">
        <div className="flex items-center gap-2 text-xs">
          <span className="chip bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            {task.projectName}
          </span>
          <span className="text-muted">
            ${task.minRate} – ${task.maxRate}/h
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            title="Edit task"
            onClick={() => onEdit(task)}
            className="p-1.5 rounded-md text-muted hover:text-primary hover:bg-emerald-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
            </svg>
          </button>
          <button
            title="Delete task"
            onClick={() => onDelete(task)}
            className="p-1.5 rounded-md text-muted hover:text-red-600 hover:bg-red-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M3 6h18M8 6V4h8v2m-9 0v14h10V6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
