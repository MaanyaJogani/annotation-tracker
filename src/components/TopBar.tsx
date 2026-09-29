"use client";

import { useCallback, useEffect, useState } from "react";
import type { RateInfo, Settings } from "@/lib/types";
import { formatRateINR } from "@/lib/format";
import CreateTaskModal from "@/components/CreateTaskModal";

export default function TopBar() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [rate, setRate] = useState<RateInfo | null>(null);
  const [editingRate, setEditingRate] = useState(false);
  const [rateDraft, setRateDraft] = useState("");
  const [showQuickTask, setShowQuickTask] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const [s, r] = await Promise.all([
      fetch("/api/settings").then((res) => res.json()),
      fetch("/api/rate").then((res) => res.json()),
    ]);
    setSettings(s);
    setRate(r);
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 10 * 60 * 1000); // refresh rate every 10 min
    return () => clearInterval(t);
  }, [load]);

  async function saveManualRate() {
    const v = Number(rateDraft);
    if (Number.isNaN(v) || v <= 0) {
      setEditingRate(false);
      return;
    }
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ usdInrRate: v, rateSource: "manual" }),
    });
    setEditingRate(false);
    load();
  }

  async function copyEmail() {
    if (!settings?.workerEmail) return;
    try {
      await navigator.clipboard.writeText(settings.workerEmail);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <header className="bg-header text-white">
      <div className="max-w-[2200px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-14 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="chip bg-white/10 text-emerald-200 border border-white/15">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Worker:
          </span>
          <button
            onClick={copyEmail}
            title={copied ? "Copied!" : "Copy email"}
            className="text-sm text-emerald-100/90 font-mono truncate hover:text-white transition-colors"
          >
            {settings?.workerEmail || "set email in Settings"}
          </button>
          <svg
            className="w-3.5 h-3.5 opacity-60 shrink-0"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            viewBox="0 0 24 24"
          >
            <path d="M8 8h12M8 12h12M8 16h12M4 4h2v16H4z" />
          </svg>
        </div>

        <div className="flex items-center gap-3">
          <div className="chip bg-white/10 border border-white/15 text-emerald-200">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path d="M12 2v20M17 7H9.5a2.5 2.5 0 0 0 0 5h5a2.5 2.5 0 0 1 0 5H6" />
            </svg>
            {editingRate ? (
              <span className="flex items-center gap-1">
                <input
                  autoFocus
                  className="w-20 bg-transparent border-b border-emerald-300 text-white text-center outline-none"
                  value={rateDraft}
                  onChange={(e) => setRateDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && saveManualRate()}
                  placeholder="95.93"
                />
                <span>/USD</span>
                <button onClick={saveManualRate} className="ml-1 text-white font-bold">
                  ✓
                </button>
                <button onClick={() => setEditingRate(false)} className="text-white/70">
                  ✕
                </button>
              </span>
            ) : (
              <>
                <span>Rate: {rate?.rate ? formatRateINR(rate.rate) : "—"}/USD</span>
                <button
                  title="Set rate manually"
                  onClick={() => {
                    setRateDraft(rate?.rate ? String(rate.rate) : "");
                    setEditingRate(true);
                  }}
                  className="opacity-70 hover:opacity-100"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </button>
              </>
            )}
          </div>

          <button
            onClick={() => setShowQuickTask(true)}
            className="btn-primary px-3.5 py-1.5 text-sm flex items-center gap-1.5"
          >
            <span className="text-base leading-none">+</span> Log Task
          </button>
        </div>
      </div>
      <CreateTaskModal
        open={showQuickTask}
        onClose={() => setShowQuickTask(false)}
        onCreated={() => {
          setShowQuickTask(false);
          window.dispatchEvent(new Event("tasks-changed"));
        }}
      />
    </header>
  );
}
