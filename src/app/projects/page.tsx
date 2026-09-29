"use client";

import { useCallback, useEffect, useState } from "react";
import type { Project } from "@/lib/types";

const emptyForm = { name: "", minRate: "", maxRate: "" };

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then(setProjects)
      .catch(() => setProjects([]));
  }, []);

  useEffect(load, [load]);

  async function save() {
    setError("");
    const payload = {
      name: form.name.trim(),
      minRate: Number(form.minRate || 0),
      maxRate: Number(form.maxRate || 0),
    };
    if (!payload.name) {
      setError("Project name is required");
      return;
    }
    setSaving(true);
    const res = await fetch(editId ? `/api/projects/${editId}` : "/api/projects", {
      method: editId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "Failed to save");
      return;
    }
    setForm(emptyForm);
    setEditId(null);
    load();
  }

  async function remove(p: Project) {
    if (!confirm(`Delete project "${p.name}"?`)) return;
    const res = await fetch(`/api/projects/${p.id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Failed to delete");
      return;
    }
    load();
  }

  function startEdit(p: Project) {
    setEditId(p.id);
    setForm({ name: p.name, minRate: String(p.minRate), maxRate: String(p.maxRate) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="text-primary">◧</span> Projects
        </h1>
        <p className="text-sm text-muted mt-1">
          Each project carries base hourly rates ($/hr). New tasks inherit them;
          per-task rates stay editable for special rates.
        </p>
      </div>

      <div className="card p-5">
        <h2 className="font-semibold mb-4">
          {editId ? "Edit Project" : "Add Project"}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
          <div className="sm:col-span-2">
            <label className="label block mb-1.5">Project Name</label>
            <input
              className="field"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. CoAT"
            />
          </div>
          <div>
            <label className="label block mb-1.5">Min Rate ($/hr)</label>
            <input
              type="number"
              min="0"
              step="0.5"
              className="field"
              value={form.minRate}
              onChange={(e) => setForm({ ...form, minRate: e.target.value })}
              placeholder="80"
            />
          </div>
          <div>
            <label className="label block mb-1.5">Max Rate ($/hr)</label>
            <input
              type="number"
              min="0"
              step="0.5"
              className="field"
              value={form.maxRate}
              onChange={(e) => setForm({ ...form, maxRate: e.target.value })}
              placeholder="90"
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        <div className="flex justify-end gap-2 mt-4">
          {editId && (
            <button
              className="btn-ghost px-4 py-2 text-sm"
              onClick={() => {
                setEditId(null);
                setForm(emptyForm);
                setError("");
              }}
            >
              Cancel
            </button>
          )}
          <button className="btn-primary px-5 py-2 text-sm" onClick={save} disabled={saving}>
            {saving ? "Saving…" : editId ? "Save Changes" : "Add Project"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {projects.map((p) => (
          <div key={p.id} className="card p-5 flex flex-col gap-3">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg">{p.name}</h3>
                <p className="text-xs text-muted mt-0.5">{p.taskCount ?? 0} task(s)</p>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => startEdit(p)}
                  title="Edit"
                  className="p-1.5 rounded-md hover:bg-emerald-50 text-muted hover:text-primary"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </button>
                <button
                  onClick={() => remove(p)}
                  title="Delete"
                  className="p-1.5 rounded-md hover:bg-red-50 text-muted hover:text-red-600"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M3 6h18M8 6V4h8v2m-9 0v14h10V6" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2">
                <p className="text-[0.65rem] font-semibold text-emerald-700/80 uppercase tracking-wide">
                  Min Rate
                </p>
                <p className="font-semibold text-emerald-800">${p.minRate}/hr</p>
              </div>
              <div className="rounded-lg bg-violet-50 border border-violet-100 px-3 py-2">
                <p className="text-[0.65rem] font-semibold text-violet-700/80 uppercase tracking-wide">
                  Max Rate
                </p>
                <p className="font-semibold text-violet-800">${p.maxRate}/hr</p>
              </div>
            </div>
          </div>
        ))}
        {projects.length === 0 && (
          <div className="card p-10 text-center text-muted md:col-span-2 xl:col-span-3">
            No projects yet — add your first one above.
          </div>
        )}
      </div>
    </div>
  );
}
