"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Project, Task } from "@/lib/types";
import KanbanCard from "@/components/KanbanCard";
import TaskModal from "@/components/TaskModal";
import {
  formatHoursSummary,
  formatUSD,
  formatINR,
  formatRateINR,
} from "@/lib/format";
import { usdRangeText } from "@/lib/payout";

interface Stats {
  totalTasks: number;
  ready: number;
  paid: number;
  revoked: number;
  totalMinutes: number;
  usdMin: number;
  usdMax: number;
  minRateSeen: number;
  maxRateSeen: number;
  rate: number;
  approvalRate: number | null;
  reviewedCount: number;
  ledger: { count: number; totalUsd: number; totalInr: number };
  byStatusUsdMin: number;
  byStatusUsdMax: number;
}

const columns = [
  {
    group: "in_progress" as const,
    title: "In Progress",
    dot: "bg-amber-400",
    side: "All active",
  },
  {
    group: "completed" as const,
    title: "Completed & Verified",
    dot: "bg-emerald-500",
    side: "Recent 5",
  },
  {
    group: "paid" as const,
    title: "Paid & Closed",
    dot: "bg-violet-500",
    side: "Settled",
  },
];

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [editing, setEditing] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [reviewFilter, setReviewFilter] = useState("all");
  const [commentsOnly, setCommentsOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [s, t, p] = await Promise.all([
      fetch("/api/stats").then((r) => r.json()),
      fetch("/api/tasks").then((r) => r.json()),
      fetch("/api/projects").then((r) => r.json()),
    ]);
    setStats(s);
    setTasks(t);
    setProjects(p);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("tasks-changed", handler);
    return () => window.removeEventListener("tasks-changed", handler);
  }, [load]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return tasks.filter((t) => {
      if (t.statusShowOnBoard === false) return false;
      if (stageFilter !== "all" && t.statusKanbanGroup !== stageFilter) return false;
      if (projectFilter !== "all" && t.projectId !== projectFilter) return false;
      if (reviewFilter !== "all" && t.approvalStatus !== reviewFilter) return false;
      if (commentsOnly && !t.reviewerComment) return false;
      if (!q) return true;
      return (
        `task ${t.taskNumber}`.toLowerCase().includes(q) ||
        t.taskUuid.toLowerCase().includes(q) ||
        t.stageUuid.toLowerCase().includes(q) ||
        t.notes.toLowerCase().includes(q)
      );
    });
  }, [tasks, search, stageFilter, projectFilter, reviewFilter, commentsOnly]);

  const commentsCount = useMemo(
    () => tasks.filter((t) => t.statusShowOnBoard !== false && t.reviewerComment).length,
    [tasks]
  );

  async function setStatus(t: Task, statusName: string) {
    const all = await fetch("/api/statuses").then((r) => r.json());
    const target = all.find((s: { name: string }) => s.name === statusName);
    if (!target) return;
    await fetch(`/api/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusId: target.id }),
    });
    load();
  }

  async function setApproval(t: Task, approval: string) {
    await fetch(`/api/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approvalStatus: approval }),
    });
    load();
  }

  async function updateNotes(t: Task, notes: string) {
    await fetch(`/api/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    });
    load();
  }

  async function updateComment(t: Task, reviewerComment: string) {
    await fetch(`/api/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewerComment }),
    });
    load();
  }

  async function deleteTask(t: Task) {
    if (!confirm(`Delete Task ${t.taskNumber}? This cannot be undone.`)) return;
    await fetch(`/api/tasks/${t.id}`, { method: "DELETE" });
    load();
  }

  if (loading || !stats) {
    return <div className="card p-16 text-center text-muted">Loading board…</div>;
  }

  const rate = stats.rate;
  const barGreen = stats.totalTasks > 0 ? ((stats.ready + stats.paid) / stats.totalTasks) * 100 : 0;
  const barRed = stats.totalTasks > 0 ? (stats.revoked / stats.totalTasks) * 100 : 0;
  const byStatusText =
    stats.byStatusUsdMin === 0 && stats.byStatusUsdMax === 0
      ? formatUSD(0)
      : usdRangeText(stats.byStatusUsdMin, stats.byStatusUsdMax);

  return (
    <div className="space-y-5">
      {/* Hero banner */}
      <section className="rounded-2xl p-6 text-white bg-gradient-to-br from-hero-from to-hero-to shadow-lg">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center text-xl shrink-0">
            ₹
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip bg-white/15 border border-white/20 text-violet-100">
                ◎ CUMULATIVE WEEKLY PAYOUTS RECEIVED
              </span>
              <span className="chip bg-white/10 border border-white/15 text-white/80">
                {stats.ledger.count} weekly payouts logged
              </span>
            </div>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-8 gap-y-2">
              <div>
                <p className="text-[0.65rem] font-bold text-white/70 uppercase tracking-wider">
                  Total Paid USD
                </p>
                <p className="text-3xl font-bold">{formatUSD(stats.ledger.totalUsd)}</p>
              </div>
              <div className="w-px h-10 bg-white/20 hidden sm:block" />
              <div>
                <p className="text-[0.65rem] font-bold text-white/70 uppercase tracking-wider">
                  Total Paid INR
                </p>
                <p className="text-3xl font-bold text-amber-300">{formatINR(stats.ledger.totalInr)}</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-white/70 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-300" />
              Estimated {usdRangeText(stats.usdMin, stats.usdMax)} · Calculated by Status –{" "}
              {byStatusText}
            </p>
          </div>
        </div>
      </section>

      {/* Stat cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="card p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[0.65rem] font-bold text-muted uppercase tracking-wider">
              Total Tasks
            </p>
            <span className="text-muted">✎</span>
          </div>
          <p className="text-3xl font-bold">{stats.totalTasks}</p>
          <p className="text-xs text-muted">
            <span className="text-emerald-600 font-semibold">{stats.ready} ready</span>
            {" · "}
            <span className="text-violet-600 font-semibold">{stats.paid} paid</span>
            {stats.revoked > 0 && (
              <>
                {" · "}
                <span className="text-red-500 font-semibold">{stats.revoked} revoked</span>
              </>
            )}
          </p>
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden flex">
            <div className="bg-emerald-500 h-full" style={{ width: `${barGreen}%` }} />
            <div className="bg-red-400 h-full" style={{ width: `${barRed}%` }} />
          </div>
        </div>

        <div className="card p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[0.65rem] font-bold text-muted uppercase tracking-wider">
              Total Time
            </p>
            <span className="text-muted">◷</span>
          </div>
          <p className="text-3xl font-bold">
            {(stats.totalMinutes / 60).toFixed(1)} <span className="text-xl">hrs</span>
          </p>
          <p className="text-xs text-muted">({stats.totalMinutes} mins)</p>
          <p className="text-[0.7rem] text-muted pt-1 border-t border-line/70">
            Across all tasks
          </p>
        </div>

        <div className="card p-4 space-y-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[0.65rem] font-bold text-muted uppercase tracking-wider">
              USD Payout (Est.)
            </p>
            <span className="text-emerald-600">$</span>
          </div>
          <p className="text-2xl font-bold text-emerald-700 leading-snug">
            {formatUSD(stats.usdMin)} –<br /> {formatUSD(stats.usdMax)}
          </p>
          <p className="text-[0.7rem] text-muted pt-1 border-t border-line/70">
            Min ${stats.minRateSeen}/hr · Max ${stats.maxRateSeen}/hr
          </p>
        </div>

        <div className="card p-4 space-y-2.5 !bg-[#0b3d2c] !border-[#0b3d2c] text-white">
          <div className="flex items-center justify-between">
            <p className="text-[0.65rem] font-bold text-emerald-200/80 uppercase tracking-wider">
              INR Payout (Est.)
            </p>
            <span className="text-emerald-300">↗</span>
          </div>
          <p className="text-2xl font-bold text-emerald-50 leading-snug">
            {rate > 0 ? formatINR(stats.usdMin * rate) : "—"} –<br />{" "}
            {rate > 0 ? formatINR(stats.usdMax * rate) : ""}
          </p>
          <p className="text-[0.7rem] text-emerald-200/70 pt-1 border-t border-white/15">
            {rate > 0 ? `Converted at ${formatRateINR(rate)}/USD` : "Rate unavailable"}
          </p>
        </div>

        <div className="card p-4 space-y-2.5 sm:col-span-2 xl:col-span-1">
          <div className="flex items-center justify-between">
            <p className="text-[0.65rem] font-bold text-muted uppercase tracking-wider">
              Approval Rate
            </p>
            <span className="text-muted">%</span>
          </div>
          <p className="text-3xl font-bold">
            {stats.approvalRate === null ? "0%" : `${stats.approvalRate}%`}
          </p>
          <span className="chip bg-slate-100 text-slate-500 border border-line w-fit">
            {stats.reviewedCount === 0 ? "No reviews" : `${stats.reviewedCount} reviewed`}
          </span>
        </div>
      </section>

      {/* Filters */}
      <section className="card p-3 flex flex-wrap items-center gap-2">
        <input
          className="field flex-1 min-w-52"
          placeholder="Search ID, stage, notes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="field w-36" value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}>
          <option value="all">All Stages</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="paid">Paid</option>
        </select>
        <select className="field w-40" value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)}>
          <option value="all">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select className="field w-40" value={reviewFilter} onChange={(e) => setReviewFilter(e.target.value)}>
          <option value="all">All Review States</option>
          <option value="pending">Pending Review</option>
          <option value="accepted">Accepted</option>
          <option value="rejected">Rejected</option>
        </select>
        <button
          onClick={() => setCommentsOnly((v) => !v)}
          className={`chip border px-3 py-1.5 ${
            commentsOnly
              ? "bg-emerald-600 text-white border-emerald-600"
              : "bg-surface text-muted border-line hover:border-primary/50"
          }`}
        >
          💬 Comments {commentsCount} of {tasks.filter((t) => t.statusShowOnBoard !== false).length}
        </button>
      </section>

      {/* Kanban */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {columns.map((col) => {
          const colTasks = filtered.filter((t) => t.statusKanbanGroup === col.group);
          const shown =
            col.group === "completed" ? colTasks.slice(0, 5) : colTasks;
          return (
            <div key={col.group} className="rounded-2xl bg-slate-100/60 border border-line p-3 space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <h2 className="font-bold text-sm">{col.title}</h2>
                  <span className="chip bg-white border border-line text-muted">
                    {colTasks.length}
                  </span>
                </div>
                <span className="text-[0.7rem] text-muted">{col.side}</span>
              </div>

              {shown.map((t) => (
                <KanbanCard
                  key={t.id}
                  task={t}
                  rate={rate}
                  onEdit={(x) => {
                    setEditing(x);
                    setModalOpen(true);
                  }}
                  onDelete={deleteTask}
                  onSetStatus={setStatus}
                  onSetApproval={setApproval}
                  onUpdateNotes={updateNotes}
                  onUpdateComment={updateComment}
                />
              ))}

              {col.group === "completed" && colTasks.length > 5 && (
                <p className="text-center text-xs text-muted py-1">
                  + {colTasks.length - 5} older — use the Detailed Sheet
                </p>
              )}

              {colTasks.length === 0 && (
                <div className="border-2 border-dashed border-line rounded-xl p-8 text-center">
                  <p className="text-2xl mb-2 opacity-40">{col.group === "paid" ? "₹" : "○"}</p>
                  <p className="text-xs text-muted font-medium">
                    {col.group === "paid"
                      ? "No settled tasks yet. When weekly payouts arrive, move verified tasks here."
                      : "Nothing here right now."}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </section>

      <TaskModal
        task={editing}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
      />
    </div>
  );
}
