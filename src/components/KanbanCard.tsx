"use client";

import { useState } from "react";
import type { Task } from "@/lib/types";
import { formatDateTime, formatMinutesChip } from "@/lib/format";
import { inrRangeText, projectedUsd, usdRangeText } from "@/lib/payout";

interface Props {
  task: Task;
  rate: number;
  onOpen: (t: Task) => void;
  onSetStatus: (t: Task, statusName: string) => void;
  onSetApproval: (t: Task, approval: string) => void;
}

function CopyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-slate-50/70 px-2.5 py-1.5">
      <div className="min-w-0">
        <p className="text-[0.6rem] font-bold text-muted uppercase tracking-wider">{label}</p>
        <p className="font-mono text-[0.65rem] text-slate-600 truncate">{value}</p>
      </div>
      <button
        title={copied ? "Copied!" : `Copy ${label.toLowerCase()}`}
        onClick={(e) => {
          e.stopPropagation();
          navigator.clipboard.writeText(value).catch(() => {});
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
        className="shrink-0 text-muted hover:text-primary"
      >
        {copied ? (
          <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
        ) : (
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>
        )}
      </button>
    </div>
  );
}

export default function KanbanCard({ task, rate, onOpen, onSetStatus, onSetApproval }: Props) {
  const usd = projectedUsd(task.timeSpentMinutes, task.minRate, task.maxRate);
  const running = task.timerStartedAt !== null;
  const group = task.statusKanbanGroup;

  return (
    <div
      onClick={() => onOpen(task)}
      className="card p-3.5 space-y-2.5 cursor-pointer hover:border-primary/40 hover:shadow-md transition-all"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-bold">Task {task.taskNumber}</h3>
        <span className="chip bg-slate-100 text-slate-600 border border-line">
          {formatMinutesChip(task.timeSpentMinutes)}
        </span>
      </div>

      {group === "in_progress" && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onSetStatus(task, "Completed");
          }}
          className="w-full btn-primary py-2 text-xs font-semibold flex items-center justify-center gap-1.5"
        >
          <span>☑</span> Mark Completed →
        </button>
      )}

      {group === "completed" && (
        <>
          <div>
            <p className="text-[0.6rem] font-bold text-muted uppercase tracking-wider mb-1">
              Review Status
            </p>
            <select
              value={task.approvalStatus}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => onSetApproval(task, e.target.value)}
              className="field py-1.5 text-xs"
            >
              <option value="pending">Pending Review</option>
              <option value="accepted">Accepted</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSetStatus(task, "Paid & Closed");
              }}
              className="flex-1 py-2 text-xs font-semibold rounded-[0.6rem] bg-violet-600 text-white hover:bg-violet-700 transition-colors flex items-center justify-center gap-1.5"
            >
              <span>₹</span> Move to Paid →
            </button>
            <button
              title="Move back to In Progress"
              onClick={(e) => {
                e.stopPropagation();
                onSetStatus(task, "In Progress");
              }}
              className="btn-ghost p-2 text-muted"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5" />
              </svg>
            </button>
          </div>
        </>
      )}

      <CopyRow label="Task ID" value={task.taskUuid} />
      <CopyRow label="Stage ID" value={task.stageUuid} />

      <div className="grid grid-cols-2 gap-2 text-[0.7rem]">
        <div className="rounded-lg border border-line px-2 py-1.5">
          <p className="flex items-center gap-1 text-muted font-semibold">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 11h18" /></svg>
            START
          </p>
          <p className="text-slate-600 mt-0.5">{formatDateTime(task.startAt)}</p>
        </div>
        <div className="rounded-lg border border-line px-2 py-1.5">
          <p className="flex items-center gap-1 text-muted font-semibold">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 11h18" /></svg>
            END
          </p>
          {running ? (
            <p className="text-amber-600 font-semibold mt-0.5">Ongoing</p>
          ) : (
            <p className="text-slate-600 mt-0.5">{formatDateTime(task.endAt)}</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-line px-2.5 py-2 space-y-1 text-[0.7rem]">
        <div className="flex justify-between">
          <span className="text-muted font-semibold">MIN & MAX USD PAY</span>
          <span className="font-bold text-emerald-700">{usdRangeText(usd.min, usd.max)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted font-semibold">MIN & MAX INR PAY</span>
          <span className="font-bold text-emerald-800">
            {rate > 0 ? inrRangeText(usd.min * rate, usd.max * rate) : "—"}
          </span>
        </div>
      </div>

      {task.notes && (
        <p className="text-[0.7rem] text-muted line-clamp-2 pt-0.5 border-t border-line/70">
          {task.notes}
        </p>
      )}
    </div>
  );
}
