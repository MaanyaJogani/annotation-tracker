"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Project, Task } from "@/lib/types";
import TaskFilterBar from "@/components/TaskFilterBar";
import { emptyTaskFilters, filterCount, filterTasks, summarizeTasks } from "@/lib/task-filters";
import PayoutHero from "@/components/PayoutHero";
import KanbanCard from "@/components/KanbanCard";
import TaskModal from "@/components/TaskModal";
import {
  formatUSD,
  formatINR,
  formatRateINR,
} from "@/lib/format";
import { usdRangeText } from "@/lib/payout";

interface Stats {
  totalTasks: number;
  inProgress: number;
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
  byStatusUsd: number;
}

const initialCardLimit = 5;

const columns = [
  {
    group: "in_progress" as const,
    title: "In Progress",
    dot: "bg-amber-500",
    tint: "bg-amber-50/70 border-amber-100",
  },
  {
    group: "completed" as const,
    title: "Completed & Verified",
    dot: "bg-emerald-600",
    tint: "bg-emerald-50/70 border-emerald-100",
  },
  {
    group: "paid" as const,
    title: "Paid & Closed",
    dot: "bg-purple-600",
    tint: "bg-purple-50/70 border-purple-100",
  },
];

export default function Dashboard() {
  const [baseStats, setStats] = useState<Stats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [editing, setEditing] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState(emptyTaskFilters);
  const [statusError, setStatusError] = useState("");
  const [expanded, setExpanded] = useState<Partial<Record<typeof columns[number]["group"], boolean>>>({});
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

  const boardTasks = useMemo(() => tasks.filter((task) => task.statusShowOnBoard !== false), [tasks]);
  const filtered = useMemo(() => filterTasks(boardTasks, search, filters), [boardTasks, search, filters]);
  const isFiltered = filterCount(filters) > 0 || search.trim().length > 0;
  const stats = baseStats ? { ...baseStats, ...summarizeTasks(filtered),
    totalTasks: isFiltered ? filtered.length : tasks.length,
    revoked: isFiltered ? 0 : tasks.length - boardTasks.length } : null;

  async function setStatus(t: Task, statusName: string) {
    const all = await fetch("/api/statuses").then((r) => r.json());
    const target = all.find((s: { name: string }) => s.name === statusName);
    if (!target) return;
    const response = await fetch(`/api/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusId: target.id }),
    });
    if (!response.ok) {
      const data = await response.json();
      setStatusError(data.error ?? "Unable to change task status");
      return;
    }
    setStatusError("");
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
    if (!confirm(`Delete ${t.name}? This cannot be undone.`)) return;
    await fetch(`/api/tasks/${t.id}`, { method: "DELETE" });
    load();
  }

  if (loading || !stats) {
    return <div className="card p-16 text-center text-muted">Loading board…</div>;
  }

  const rate = stats.rate;
  const pct = (n: number) => (stats.totalTasks > 0 ? (n / stats.totalTasks) * 100 : 0);
  const barInProgress = pct(stats.inProgress);
  const barReady = pct(stats.ready);
  const barPaid = pct(stats.paid);
  const barRevoked = pct(stats.revoked);
  const byStatusText = formatUSD(stats.byStatusUsd);
  const acceptedCount = filtered.filter((task) => task.taskType !== "review" && task.approvalStatus === "accepted").length;

  return (
    <div className="space-y-5">
      {statusError && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">{statusError}</p>}
      {isFiltered && <p className="text-xs font-semibold text-emerald-700" role="status">Filtered summary · {filtered.length} matching tasks · received payouts remain cumulative</p>}
      {/* Hero banner */}
      <PayoutHero ledger={stats.ledger}>
              Estimated {usdRangeText(stats.usdMin, stats.usdMax)} · Calculated by Status –{" "}
              {byStatusText}{rate > 0 && ` (${formatINR(stats.byStatusUsd * rate)})`}
      </PayoutHero>

      {/* Stat cards */}
      <section className="summary-cards grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="summary-stack flex flex-col gap-3">
          <div className="card p-4 space-y-2 flex-1">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-muted uppercase tracking-wider">
                Total Tasks
              </p>
              <div className="flex items-center gap-1.5">
                {stats.revoked > 0 && (
                  <span className="chip bg-rose-100 text-rose-600 border border-rose-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    {stats.revoked} Revoked
                  </span>
                )}
                <span className="w-6 h-6 rounded-md border border-emerald-200 text-emerald-600 flex items-center justify-center">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                  </svg>
                </span>
              </div>
            </div>
            <div className="flex items-baseline gap-3 flex-wrap">
            <p className="summary-number font-bold">{stats.totalTasks}</p>
            <p className="text-xs text-muted">
              {stats.inProgress > 0 && <span className="font-medium">{stats.inProgress} In Progress · </span>}
              <span className="text-emerald-600 font-semibold">{stats.ready} ready</span>
              {" · "}
              <span className="text-purple-600 font-semibold">{stats.paid} paid</span>
            </p>
            </div>
            {stats.revoked > 0 && (
              <p className="text-xs text-rose-500 font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                {stats.revoked} revoked
              </p>
            )}
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden flex">
              <div className="bg-amber-400 h-full" style={{ width: `${barInProgress}%` }} />
              <div className="bg-emerald-600 h-full" style={{ width: `${barReady}%` }} />
              <div className="bg-purple-600 h-full" style={{ width: `${barPaid}%` }} />
              <div className="bg-rose-400 h-full" style={{ width: `${barRevoked}%` }} />
            </div>
          </div>

          <div className="card p-4 flex-1 flex flex-col justify-center gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-muted uppercase tracking-wider">
                Approval Rate
              </p>
              <span className="summary-icon">
                %
              </span>
            </div>
            <div className="flex items-center justify-between">
              <p className="summary-number font-bold">
                {stats.approvalRate === null ? "N/A" : `${stats.approvalRate}%`}
              </p>
              <span className="chip bg-emerald-50 text-emerald-700 border border-emerald-200">
                {stats.reviewedCount === 0 ? "No reviews" : `${acceptedCount}/${stats.reviewedCount} pass`}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden flex" aria-hidden="true">
              {stats.reviewedCount > 0 && <>
                <div className="bg-emerald-500 h-full" style={{ width: `${acceptedCount / stats.reviewedCount * 100}%` }} />
                <div className="bg-rose-500 h-full flex-1" />
              </>}
            </div>
          </div>
        </div>

        <div className="card p-4 flex flex-col">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted uppercase tracking-wider">
              Total Time
            </p>
            <span className="summary-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="9" /><path d="M12 6v6l4 2" /></svg></span>
          </div>
          <div className="flex items-baseline flex-wrap gap-x-2 mt-2">
            <p className="summary-number font-bold">{(stats.totalMinutes / 60).toFixed(2)} hrs</p>
            <span className="text-sm text-muted">({stats.totalMinutes.toLocaleString()} mins)</span>
          </div>
          <p className="text-sm text-muted mt-auto pt-4">{isFiltered ? "Across filtered tasks" : "Across board tasks"}</p>
        </div>

        <div className="card p-4 flex flex-col">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-muted uppercase tracking-wider">
              USD Payout (Est.)
            </p>
            <span className="summary-icon" aria-hidden="true">$</span>
          </div>
          <p className="summary-money font-bold text-slate-900 leading-snug mt-2">
            {formatUSD(stats.usdMin)}{stats.usdMin !== stats.usdMax && <> –<br />{formatUSD(stats.usdMax)}</>}
          </p>
          <p className="text-sm text-muted mt-auto pt-4">
            Min (${stats.minRateSeen}/h) · Max (${stats.maxRateSeen}/h)
          </p>
        </div>

        <div className="card inr-summary p-4 flex flex-col text-white">
          <div className="flex items-center justify-between">
            <p className="text-xs font-bold text-emerald-200/80 uppercase tracking-wider">
              INR Payout (Est.)
            </p>
            <span className="summary-icon" aria-hidden="true"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="m3 17 6-6 4 4 8-10M15 5h6v6" /></svg></span>
          </div>
          <p className="summary-money font-bold text-emerald-50 leading-snug mt-2">
            {rate > 0 ? formatINR(stats.usdMin * rate) : "—"}
            {rate > 0 && stats.usdMin !== stats.usdMax && <> –<br />{formatINR(stats.usdMax * rate)}</>}
          </p>
          <p className="text-sm text-emerald-200/80 mt-auto pt-4">
            {rate > 0 ? `Converted at ${formatRateINR(rate)}/USD` : "Rate unavailable"}
          </p>
        </div>
      </section>

      <TaskFilterBar tasks={boardTasks} projects={projects} search={search} onSearch={setSearch}
        filters={filters} onChange={setFilters} resultCount={filtered.length} />

      {/* Kanban */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
        {columns.map((col) => {
          const colTasks = filtered.filter((t) => t.statusKanbanGroup === col.group);
          const isExpanded = expanded[col.group] ?? false;
          const remaining = colTasks.length - initialCardLimit;
          const shown = isExpanded ? colTasks : colTasks.slice(0, initialCardLimit);
          return (
            <div key={col.group} data-stage={col.group} className={`board-column rounded-2xl border p-5 space-y-4 ${col.tint}`}>
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <h2 className="font-bold text-sm">{col.title}</h2>
                  <span className="column-count chip bg-white border border-line text-muted">
                    {colTasks.length}
                  </span>
                </div>
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

              {remaining > 0 && (
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  className="btn-ghost w-full px-3 py-2 text-sm font-semibold"
                  onClick={() => setExpanded(previous => ({ ...previous, [col.group]: !previous[col.group] }))}
                >
                  {isExpanded ? "Show less" : `Show ${remaining} more ${remaining === 1 ? "task" : "tasks"}`}
                </button>
              )}

              {colTasks.length === 0 && (
                <div className="empty-column border-2 border-dashed border-line rounded-xl p-8 text-center min-h-44 flex flex-col items-center justify-center">
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
