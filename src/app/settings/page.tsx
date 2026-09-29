"use client";

import { useCallback, useEffect, useState } from "react";
import type { KanbanGroup, Settings, Status } from "@/lib/types";
import { formatRateINR } from "@/lib/format";

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [email, setEmail] = useState("");
  const [manualRate, setManualRate] = useState("");
  const [rateSource, setRateSource] = useState<"auto" | "manual">("auto");
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [newStatus, setNewStatus] = useState("");
  const [newGroup, setNewGroup] = useState<KanbanGroup>("in_progress");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const [s, st] = await Promise.all([
      fetch("/api/settings").then((r) => r.json()),
      fetch("/api/statuses").then((r) => r.json()),
    ]);
    setSettings(s);
    setEmail(s.workerEmail ?? "");
    setRateSource(s.rateSource ?? "auto");
    setStatuses(st ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function flash(note: string) {
    setMsg(note);
    setTimeout(() => setMsg(""), 2500);
  }

  async function saveSettings(payload: Record<string, unknown>, note: string) {
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      flash(note);
      setSettings(await fetch("/api/settings").then((r) => r.json()));
    }
  }

  async function removeStatus(id: string, name: string) {
    if (!confirm(`Delete status "${name}"?`)) return;
    const res = await fetch(`/api/statuses/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      alert(j.error ?? "Failed to delete status");
      return;
    }
    setStatuses(await fetch("/api/statuses").then((r) => r.json()));
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="text-primary">◧</span> Settings
        </h1>
        <p className="text-sm text-muted mt-1">
          Worker identity, exchange rate behaviour, and the task status list.
        </p>
      </div>

      {msg && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm px-4 py-2.5">
          {msg}
        </div>
      )}

      <div className="card p-5 space-y-3">
        <h2 className="font-semibold">Worker Email</h2>
        <div className="flex gap-2">
          <input
            className="field"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <button
            className="btn-primary px-5 py-2 text-sm shrink-0"
            onClick={() => saveSettings({ workerEmail: email }, "Worker email saved")}
          >
            Save
          </button>
        </div>
        <p className="text-xs text-muted">
          Shown in the top bar with a one-click copy button.
        </p>
      </div>

      <div className="card p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">USD → INR Exchange Rate</h2>
          {settings?.usdInrRate && (
            <span className="chip bg-emerald-50 text-emerald-700 border border-emerald-200">
              Current: {formatRateINR(settings.usdInrRate)} ({settings.rateSource})
            </span>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name="rateSource"
            checked={rateSource === "auto"}
            onChange={async () => {
              setRateSource("auto");
              await saveSettings({ rateSource: "auto" }, "Auto-fetch enabled");
              await fetch("/api/rate?refresh=1");
              setSettings(await fetch("/api/settings").then((r) => r.json()));
            }}
          />
          <span>
            Auto-fetch{" "}
            <span className="text-muted text-xs">
              (free sources update ~daily; polled every 10 min)
            </span>
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="radio"
            name="rateSource"
            checked={rateSource === "manual"}
            onChange={() => setRateSource("manual")}
          />
          <span>Manual override</span>
        </label>
        {rateSource === "manual" && (
          <div className="flex items-center gap-2 pl-6">
            <div className="relative w-36">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm">₹</span>
              <input
                type="number"
                step="0.01"
                min="0"
                className="field field-currency"
                placeholder="95.93"
                value={manualRate}
                onChange={(e) => setManualRate(e.target.value)}
              />
            </div>
            <button
              className="btn-primary px-4 py-2 text-sm"
              onClick={() =>
                saveSettings(
                  { rateSource: "manual", usdInrRate: Number(manualRate) },
                  "Manual rate saved"
                )
              }
            >
              Save Rate
            </button>
          </div>
        )}
        <p className="text-xs text-muted">
          Switching back to Auto resumes fetching; your manual value is kept until the next
          successful fetch.
        </p>
      </div>

      <div className="card p-5 space-y-4">
        <div>
          <h2 className="font-semibold">Task Statuses</h2>
          <p className="text-xs text-muted mt-0.5">
            Add or remove the statuses available on tasks. The default status cannot be deleted.
          </p>
        </div>
        <div className="space-y-2">
          {statuses.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between rounded-xl border border-line px-4 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: s.color }} />
                <span className="text-sm font-medium">{s.name}</span>
                {s.isDefault && (
                  <span className="chip bg-emerald-50 text-emerald-700 border border-emerald-200">
                    default
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted">
                <span className="capitalize">{s.kanbanGroup.replace("_", " ")} column</span>
                {!s.isDefault && (
                  <button
                    onClick={() => removeStatus(s.id, s.name)}
                    className="p-1 rounded-md text-muted hover:text-red-600 hover:bg-red-50"
                    title="Delete status"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path d="M3 6h18M8 6V4h8v2m-9 0v14h10V6" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-end gap-2 pt-1">
          <div>
            <label className="label block mb-1.5">New status name</label>
            <input
              className="field w-48"
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              placeholder="e.g. On Hold"
            />
          </div>
          <div>
            <label className="label block mb-1.5">Board column</label>
            <select
              className="field w-44"
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value as KanbanGroup)}
            >
              <option value="in_progress">In Progress column</option>
              <option value="completed">Completed column</option>
              <option value="paid">Paid column</option>
            </select>
          </div>
          <button
            className="btn-primary px-4 py-2 text-sm"
            onClick={async () => {
              if (!newStatus.trim()) return;
              const res = await fetch("/api/statuses", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newStatus.trim(), kanbanGroup: newGroup }),
              });
              if (!res.ok) {
                const j = await res.json().catch(() => ({}));
                alert(j.error ?? "Failed to add status");
                return;
              }
              setNewStatus("");
              setStatuses(await fetch("/api/statuses").then((r) => r.json()));
            }}
          >
            + Add Status
          </button>
        </div>
      </div>
    </div>
  );
}
