"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Project, Task } from "@/lib/types";
import TaskModal from "@/components/TaskModal";
import {
  formatDateTime,
  formatMinutesChip,
  formatRateINR,
  toDateInputValue,
} from "@/lib/format";
import { inrRangeText, projectedUsd, usdRangeText } from "@/lib/payout";

export default function SheetPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [rate, setRate] = useState(0);
  const [editing, setEditing] = useState<Task | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [t, p, r] = await Promise.all([
      fetch("/api/tasks").then((res) => res.json()),
      fetch("/api/projects").then((res) => res.json()),
      fetch("/api/rate").then((res) => res.json()),
    ]);
    setTasks(t);
    setProjects(p);
    setRate(r.rate ?? 0);
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
      if (projectFilter !== "all" && t.projectId !== projectFilter) return false;
      if (!q) return true;
      return (
        `task ${t.taskNumber}`.toLowerCase().includes(q) ||
        t.taskUuid.toLowerCase().includes(q) ||
        t.stageUuid.toLowerCase().includes(q) ||
        t.notes.toLowerCase().includes(q) ||
        (t.reviewerComment ?? "").toLowerCase().includes(q)
      );
    });
  }, [tasks, search, projectFilter]);

  function openEdit(t: Task) {
    setEditing(t);
    setModalOpen(true);
  }

  async function quickStatus(t: Task, statusName: string) {
    const status = await fetch("/api/statuses").then((r) => r.json());
    const target = (status as { id: string; name: string }[]).find(
      (s) => s.name === statusName
    );
    if (!target) return;
    await fetch(`/api/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusId: target.id }),
    });
    load();
  }

  async function removeTask(t: Task) {
    if (!confirm(`Delete Task ${t.taskNumber}? This cannot be undone.`)) return;
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

  async function setEndNow(t: Task) {
    await fetch(`/api/tasks/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endAt: new Date().toISOString() }),
    });
    load();
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <span className="text-primary">▤</span> Detailed Sheet
          </h1>
          <p className="text-sm text-muted mt-1">
            Every task with full details — click a row to edit.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            className="field w-56"
            placeholder="Search ID, stage, notes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="field w-44"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="all">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-muted border-b border-line bg-slate-50/60">
              <th className="px-4 py-3">Task</th>
              <th className="px-4 py-3">Project</th>
              <th className="px-4 py-3">Task / Stage UUID</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Start → End</th>
              <th className="px-4 py-3">Rates</th>
              <th className="px-4 py-3">Projected USD</th>
              <th className="px-4 py-3">Projected INR</th>
              <th className="px-4 py-3">Approval</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => {
              const usd = projectedUsd(t.timeSpentMinutes, t.minRate, t.maxRate);
              const running = t.timerStartedAt !== null;
              return (
                <tr
                  key={t.id}
                  className="border-b border-line/70 hover:bg-emerald-50/30 cursor-pointer"
                  onClick={() => openEdit(t)}
                >
                  <td className="px-4 py-3 font-semibold whitespace-nowrap">
                    Task {t.taskNumber}
                    {running && (
                      <span className="ml-2 chip bg-amber-100 text-amber-700">● Running</span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{t.projectName}</td>
                  <td className="px-4 py-3 font-mono text-[0.65rem] text-muted max-w-40 truncate">
                    {t.taskUuid || "—"}
                    <br />
                    {t.stageUuid || "—"}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    {formatMinutesChip(t.timeSpentMinutes)}
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    {formatDateTime(t.startAt)}
                    <br />
                    <span className={running ? "text-amber-600 font-medium" : ""}>
                      {running ? "Ongoing" : formatDateTime(t.endAt)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    ${t.minRate} – ${t.maxRate}/hr
                  </td>
                  <td className="px-4 py-3 font-semibold text-emerald-700 whitespace-nowrap">
                    {usdRangeText(usd.min, usd.max)}
                  </td>
                  <td className="px-4 py-3 text-emerald-800 whitespace-nowrap">
                    {rate > 0
                      ? inrRangeText(usd.min * rate, usd.max * rate)
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
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
                  </td>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1.5">
                      {!t.startAt && (
                        <button
                          onClick={() => setStartNow(t)}
                          className="btn-ghost px-2 py-1 text-xs"
                          title="Set start to now"
                        >
                          Start ▸
                        </button>
                      )}
                      {t.startAt && !t.endAt && !running && (
                        <button
                          onClick={() => setEndNow(t)}
                          className="btn-ghost px-2 py-1 text-xs"
                          title="Set end to now"
                        >
                          End ▪
                        </button>
                      )}
                      <button
                        onClick={() => quickStatus(t, "Completed")}
                        className="btn-ghost px-2 py-1 text-xs text-emerald-700"
                      >
                        ✓ Completed
                      </button>
                      <button
                        onClick={() => removeTask(t)}
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
                <td colSpan={10} className="px-4 py-12 text-center text-muted">
                  {tasks.length === 0
                    ? "No tasks yet — use + Log Task in the top bar."
                    : "No tasks match your filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TaskModal
        task={editing}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
      />
    </div>
  );
}
