"use client";

import { useEffect, useState } from "react";
import type { Project } from "@/lib/types";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function QuickTaskModal({ open, onClose, onCreated }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [notes, setNotes] = useState("");
  const [taskUuid, setTaskUuid] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    fetch("/api/projects")
      .then((r) => r.json())
      .then(setProjects)
      .catch(() => setProjects([]));
  }, [open]);

  if (!open) return null;

  async function create() {
    if (!projectId) {
      setError("Pick a project first (create one in Projects if empty)");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, notes, taskUuid }),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Failed to create task");
      return;
    }
    setNotes("");
    setTaskUuid("");
    onCreated();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24">
      <div className="card w-full max-w-md overflow-hidden">
        <div className="bg-header text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold">
            <span className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-sm">
              ✎
            </span>
            Log New Task
          </div>
          <button onClick={onClose} className="text-white/70 hover:text-white text-lg leading-none">
            ✕
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="label block mb-1.5">Project</label>
            <select
              className="field"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="">Select project…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (${p.minRate}/hr – ${p.maxRate}/hr)
                </option>
              ))}
            </select>
            {projects.length === 0 && (
              <p className="text-xs text-amber-600 mt-1.5">
                No projects yet — create one on the Projects page first.
              </p>
            )}
          </div>
          <div>
            <label className="label block mb-1.5">Task UUID (optional)</label>
            <input
              className="field font-mono text-xs"
              value={taskUuid}
              onChange={(e) => setTaskUuid(e.target.value)}
              placeholder="e.g. 9af12875-9442-4601-90ea-cb2c7030870b"
            />
          </div>
          <div>
            <label className="label block mb-1.5">Notes / Instructions (optional)</label>
            <textarea
              className="field"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. pair p74e01bd080; Berry Phase task…"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button className="btn-ghost px-4 py-2 text-sm" onClick={onClose}>
              Cancel
            </button>
            <button className="btn-primary px-4 py-2 text-sm" onClick={create} disabled={saving}>
              {saving ? "Creating…" : "Create Task"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
