"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Project, Task } from "@/lib/types";
import CopyField from "@/components/CopyField";
import TaskFilterBar from "@/components/TaskFilterBar";
import { emptyTaskFilters, filterTasks } from "@/lib/task-filters";
import AssignPayoutWeek from "@/components/AssignPayoutWeek";
import TaskModal from "@/components/TaskModal";
import {
  formatDateTime,
  formatMinutesChip,

} from "@/lib/format";
import { canAssignPayoutWeek, taskPayout, inrRangeText, usdRangeText } from "@/lib/payout";

export default function SheetPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [rate, setRate] = useState(0);
  const [assigning, setAssigning] = useState<Task | null>(null);
  const [editing, setEditing] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [requestedPage, setPage] = useState(1);
  const [filters, setFilters] = useState(emptyTaskFilters);
  const [statusError, setStatusError] = useState("");
  const [loading, setLoading] = useState(true);

  const [loadError, setLoadError] = useState(false);
  const load = useCallback(async () => {
    try {
      const [t, p, r] = await Promise.all(["tasks", "projects", "rate"].map(async resource => {
        const response = await fetch(`/api/${resource}`);
        if (!response.ok) throw new Error();
        return response.json();
      }));
      setTasks(t);
      setProjects(p);
      setRate(r.rate ?? 0);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener("tasks-changed", handler);
    return () => window.removeEventListener("tasks-changed", handler);
  }, [load]);

  const filtered = useMemo(() => filterTasks(tasks, search, filters), [tasks, search, filters]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const offset = (page - 1) * pageSize;
  const visibleTasks = filtered.slice(offset, offset + pageSize);

  function openEdit(t: Task) {
    setEditing(t);
    setModalOpen(true);
  }

  async function completeTask(t: Task) {
    const response = await fetch(`/api/tasks/${t.id}/timer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "complete" }),
    });
    if (!response.ok) {
      const data = await response.json();
      setStatusError(data.error ?? "Unable to change task status");
      return;
    }
    setStatusError("");
    load();
  }

  async function removeTask(t: Task) {
    if (!confirm(`Delete ${t.name}? This cannot be undone.`)) return;
    await fetch(`/api/tasks/${t.id}`, { method: "DELETE" });
    load();
  }

  async function setStartNow(t: Task) {
    await fetch(`/api/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startAt: new Date().toISOString() }),
    });
    load();
  }

  return (
    <div className="space-y-5">
      {loadError && <p role="alert" className="card p-3">Could not load the sheet. <button className="underline" onClick={load}>Retry</button></p>}
      {statusError && <p role="alert" className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-sm text-rose-800">{statusError}</p>}
      <header className="sheet-banner">
        <div><h1>Detailed Sheet</h1><p>Select a task to edit its details.</p></div>
        <dl>{[["In progress", "in_progress"], ["Completed", "completed"], ["Paid & closed", "paid"]].map(([label, stage]) =>
          <div key={stage}><dt>{label}</dt><dd>{loading ? "—" : filtered.filter(t => t.statusShowOnBoard !== false && t.statusKanbanGroup === stage).length}</dd></div>)}</dl>
      </header>
      <div className="sheet-surface">
      <TaskFilterBar tasks={tasks} projects={projects} search={search} onSearch={value => { setSearch(value); setPage(1); }}
        filters={filters} onChange={value => { setFilters(value); setPage(1); }} resultCount={filtered.length} />

      <div className="sheet-scroll">
        <table className="sheet-table" aria-label="Task details">
          <thead><tr>{["Task & project","Session","Projected pay","Stage & approval","Payout week","Actions"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead>
          <tbody>
            {visibleTasks.map((t) => {
              const usd = taskPayout(t);
              const running = t.timerStartedAt !== null;
              return (
                <tr
                  key={t.id}
                  className="border-b border-line/70 hover:bg-emerald-50/30 cursor-pointer"
                  onClick={() => openEdit(t)}
                >
                  <td className="sheet-identity">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <button className="sheet-task-name" onClick={e => { e.stopPropagation(); openEdit(t); }}>{t.name}</button>
                      <span className={`chip ${t.taskType === "review" ? "bg-purple-100 text-purple-800" : "bg-emerald-100 text-emerald-800"}`}>
                        {t.taskType === "review" ? "Review" : "Annotation"}
                      </span>
                    </div>
                    <small>{t.projectName}</small>
                    {(t.taskUuid || t.stageUuid) && (
                      <details onClick={e => e.stopPropagation()} className="sheet-ids">
                        <summary>Identifiers</summary>
                        <CopyField label="Task UUID" value={t.taskUuid} />
                        <CopyField label="Stage UUID" value={t.stageUuid} />
                      </details>
                    )}
                  </td>
                  <td data-label="Session"><strong>{formatMinutesChip(t.timeSpentMinutes)}</strong>
                    <small>Start · {formatDateTime(t.startAt)}</small><small>{running ? "● Running" : `End · ${formatDateTime(t.endAt)}`}</small>
                  </td>
                  <td data-label="Projected pay" className="sheet-money"><strong>{usdRangeText(usd.min, usd.max)}</strong>
                    <small>{rate > 0 ? inrRangeText(usd.min * rate, usd.max * rate) : "—"}</small>
                    <small>{t.taskType === "review" ? `$${t.minRate}/hr` : `$${t.minRate} – $${t.maxRate}/hr`}</small>
                  </td>
                  <td data-label="Stage & approval"><strong className="sheet-stage">{t.statusName || "Unassigned"}</strong>
                    {t.taskType === "review" ? <span className="text-muted">Not applicable</span> : (
                    <span
                      className={`chip ${
                        t.approvalStatus === "accepted"
                          ? "bg-emerald-100 text-emerald-700"
                          : t.approvalStatus === "rejected"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {t.approvalStatus === "pending"
                        ? "Pending Review"
                        : t.approvalStatus === "accepted"
                          ? "Accepted"
                          : "Rejected"}
                    </span>
                    )}
                  </td>
                  <td data-label="Payout week">{canAssignPayoutWeek(t.statusKanbanGroup) ? (
                    <button type="button" className="week-link" aria-label={`Edit payout week for ${t.name}`} onClick={event => { event.stopPropagation(); setAssigning(t); }}>{t.weekNumber ? `Week ${t.weekNumber}` : "Assign week"}</button>
                  ) : <span className="text-muted">{t.weekNumber ? `Week ${t.weekNumber}` : "—"}</span>}</td>
                  <td className="sheet-actions" onClick={(e) => e.stopPropagation()}>
                    <div className="flex flex-wrap gap-1.5">
                      {t.activeFocus && !t.startAt && (
                        <button
                          onClick={() => setStartNow(t)}
                          className="btn-ghost px-2 py-1 text-xs"
                          title="Set start to now"
                        >
                          Start ▸
                        </button>
                      )}
                      {t.activeFocus && (
                        <button
                          onClick={() => completeTask(t)}
                          className="btn-ghost px-2 py-1 text-xs text-emerald-700"
                        >
                          Complete task
                        </button>
                      )}
                      <button
                        aria-label={`Delete ${t.name}`} title="Delete task" onClick={() => removeTask(t)}
                        className="btn-ghost px-2 py-1 text-xs text-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted">
                  {loadError ? "Task list unavailable." : loading ? "Loading tasks…" : tasks.length === 0
                    ? "No tasks yet — use + Log Task in the top bar."
                    : "No tasks match your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <nav aria-label="Task pagination" className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-white rounded-b-xl px-4 py-3 text-sm">
        <label className="flex items-center gap-2">Tasks per page
          <select className="rounded-lg border border-line px-2 py-1.5" value={pageSize} onChange={event => {
            setPageSize(Number(event.target.value));
            setPage(1);
          }}>
            {[10, 20, 50].map(size => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-muted mr-2" role="status">{filtered.length ? `${offset + 1}–${offset + visibleTasks.length} of ${filtered.length}` : "0 tasks"}</span>
          <button type="button" className="btn-ghost px-3 py-1.5 disabled:opacity-40" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
          <button type="button" className="btn-ghost px-3 py-1.5 disabled:opacity-40" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      </nav>
      </div>

      {assigning && <AssignPayoutWeek task={assigning} onClose={() => setAssigning(null)} onSaved={load} />}
      <TaskModal
        task={editing}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
      />
    </div>
  );
}
