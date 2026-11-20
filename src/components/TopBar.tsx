"use client";

import { useCallback, useEffect, useState } from "react";
import type { RateInfo, Settings } from "@/lib/types";
import { formatRateINR } from "@/lib/format";
import { copyText } from "@/lib/clipboard";
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
    const result = await copyText(settings.workerEmail);
    if (result === "copied") {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  }

  return (
    <header className="bg-header text-white">
      <div className="max-w-[2200px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-14 min-h-16 py-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 max-w-full items-center gap-2.5">
          <div className="header-worker flex min-w-0 items-center gap-2 rounded-md px-3 py-1.5 text-lg">
          <span className="flex shrink-0 items-center gap-2 text-emerald-300">
            <svg aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="m3 6 9 7 9-7" />
            </svg>
            Worker:
          </span>
          {settings?.workerEmail ? (
            <span className="min-w-0 break-all font-mono text-emerald-50">
              {settings.workerEmail}
            </span>
          ) : (
            <a href="/settings" className="text-sm text-amber-300 underline underline-offset-2 hover:text-amber-200">
              Set email in Settings →
            </a>
          )}
          </div>
          {settings?.workerEmail && (
            <button
              onClick={copyEmail}
              title={copied ? "Copied!" : "Copy email"}
              aria-label={copied ? "Copied!" : "Copy email"}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-800/70 text-emerald-200 transition-colors hover:bg-emerald-700 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
            >
              {copied ? (
                <svg className="h-5 w-5 text-emerald-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <rect x="9" y="9" width="11" height="11" rx="2" />
                  <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                </svg>
              )}
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="header-rate flex items-center gap-2 rounded-md px-3 py-1.5 text-lg whitespace-nowrap">
            <svg className="w-4 h-4 text-amber-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
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
                <span>Rate: <span className="header-rate-value">{rate?.rate ? formatRateINR(rate.rate) : "—"}/USD</span></span>
                <button
                  title="Set rate manually"
                  onClick={() => {
                    setRateDraft(rate?.rate ? String(rate.rate) : "");
                    setEditingRate(true);
                  }}
                  className="opacity-70 hover:opacity-100"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                  </svg>
                </button>
              </>
            )}
          </div>

          <button
            onClick={() => setShowQuickTask(true)}
            className="btn-primary px-4 py-2 text-sm flex items-center gap-2 whitespace-nowrap"
          >
            <span className="text-xl leading-none">+</span> Log Task
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
