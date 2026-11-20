"use client";

import { ReviewFields, ReviewDecision } from "@/components/ReviewFields";
import { CopyButton } from "@/components/CopyField";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Project, Task } from "@/lib/types";
import { toDateInputValue, formatRateINR } from "@/lib/format";
import { inrRangeText, usdRangeText } from "@/lib/payout";
import { elapsedMilliseconds } from "@/lib/focus-timer";

type Draft = {
  name: string; projectId: string; taskUuid: string; stageUuid: string;
  notes: string; minRate: string; maxRate: string; startAt: string;
  taskType: "annotation" | "review"; reviewJustification: string; taskerFeedback: string; reviewWorkerEmail: string; taskerDecision: string;
};
// Keep only unsaved fields while moving between pages in this tab.
const pendingDrafts = new Map<string, Partial<Draft>>();
const makeDraft = (task: Task): Draft => ({
  name: task.name, projectId: task.projectId, taskUuid: task.taskUuid,
  stageUuid: task.stageUuid, notes: task.notes, minRate: String(task.minRate), maxRate: String(task.maxRate),
  startAt: toDateInputValue(task.startAt), taskType: task.taskType ?? "annotation",
  reviewJustification: task.reviewJustification ?? "", taskerFeedback: task.taskerFeedback ?? "",
  reviewWorkerEmail: task.reviewWorkerEmail ?? "", taskerDecision: task.taskerDecision ?? "",
});
function clock(seconds: number) {
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60].map((value) => String(value).padStart(2, "0")).join(":");
}
async function readJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "Unable to save. Please try again.");
  return data;
}

export default function FocusPage() {
  const [task, setTask] = useState<Task | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [rate, setRate] = useState(0);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [customMinutes, setCustomMinutes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [unsaved, setUnsaved] = useState(false);
  const taskId = useRef<string | null>(null);
  const requestBusy = useRef(false);
  const dirty = useRef(false);

  const load = useCallback(async () => {
    try {
      const [all, projectRows, exchange] = await Promise.all([
        readJson<Task[]>("/api/tasks"), readJson<Project[]>("/api/projects"), readJson<{rate: number | null}>("/api/rate"),
      ]);
      const active = all.find((item) => item.activeFocus) ?? null;
      setTask(active); setProjects(projectRows); setRate(exchange.rate ?? 0); setNow(Date.now());
      if (taskId.current !== (active?.id ?? null) || !dirty.current) {
        const changes = active ? pendingDrafts.get(active.id) : undefined;
        setDraft(active ? { ...makeDraft(active), ...changes } : null);
        dirty.current = Boolean(changes); setUnsaved(Boolean(changes));
      }
      taskId.current = active?.id ?? null;
    } catch (err) { setError((err as Error).message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const initialLoad = setTimeout(() => { void load(); }, 0);
    const tick = setInterval(() => setNow(Date.now()), 250);
    const changed = () => { if (!requestBusy.current) void load(); };
    window.addEventListener("tasks-changed", changed);
    window.addEventListener("focus", changed);
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirty.current) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => {
      clearTimeout(initialLoad); clearInterval(tick); window.removeEventListener("tasks-changed", changed);
      window.removeEventListener("focus", changed); window.removeEventListener("beforeunload", beforeUnload);
    };
  }, [load]);

  const running = Boolean(task?.timerStartedAt);
  const milliseconds = task ? elapsedMilliseconds(task, now) : 0;
  // Clock and earnings share one whole-second snapshot so they advance together.
  const elapsedSeconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(elapsedSeconds / 60);
  const elapsedHours = elapsedSeconds / 3600;
  const minRate = Number(draft?.minRate ?? 0), maxRate = Number(draft?.taskType === "review" ? draft.minRate : draft?.maxRate ?? 0);
  const usdMin = elapsedHours * (Number.isFinite(minRate) ? minRate : 0);
  const usdMax = elapsedHours * (Number.isFinite(maxRate) ? maxRate : 0);
  const form: Draft = draft ?? { name: "", projectId: projects[0]?.id ?? "", taskUuid: "", stageUuid: "", notes: "", minRate: "0", maxRate: "0", startAt: "", taskType: "annotation", reviewJustification: "", taskerFeedback: "", reviewWorkerEmail: "", taskerDecision: "" };
  const review = form.taskType === "review";
  const validCustom = /^\d+$/.test(customMinutes) && Number(customMinutes) > 0 && Number(customMinutes) <= 1000000;

  function edit<K extends keyof Draft>(key: K, value: Draft[K]) {
    if (!task) return;
    pendingDrafts.set(task.id, { ...pendingDrafts.get(task.id), [key]: value });
    dirty.current = true; setUnsaved(true); setNotice(""); setDraft((previous) => previous ? { ...previous, [key]: value } : null);
  }
  function fields() {
    if (!draft) return {};
    if (!form.minRate.trim() || (!review && !form.maxRate.trim())) throw new Error("Both hourly rates are required.");
    const changes = { ...pendingDrafts.get(task!.id) };
    return { ...changes, taskerDecision: changes.taskerDecision === "" ? null : changes.taskerDecision };
  }
  async function act(action: "start" | "resume" | "pause" | "save" | "complete" | "adjust" | "reset", sign = 1) {
    if (!task || requestBusy.current) return;
    if (action === "reset" && !window.confirm("Reset this task's timer to 00:00:00? This clears all saved elapsed time and pauses the timer. Task details and the original start date stay unchanged. This cannot be undone.")) return;
    requestBusy.current = true; setBusy(true); setError(""); setNotice("");
    try {
      const body = action === "adjust" ? { delta: sign * Number(customMinutes) }
        : { action, ...(["save", "complete"].includes(action) ? { fields: fields() } : {}) };
      const row = await readJson<Task>(`/api/tasks/${task.id}/${action === "adjust" ? "adjust-minutes" : "timer"}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      setNow(Date.now());
      if (action === "save" || action === "complete") pendingDrafts.delete(task.id);
      if (action === "complete") {
        setTask(null); setDraft(null); taskId.current = null; dirty.current = false; setUnsaved(false);
        setNotice(review ? "Review completed. End time and progress saved." : "Task completed and sent to review. End time and progress saved.");
      } else {
        setTask({ ...task, ...row });
        if (action === "save") { setDraft(makeDraft(row)); dirty.current = false; setUnsaved(false); }
        else setDraft((previous) => previous ? { ...previous, startAt: toDateInputValue(row.startAt) } : previous);
        if (action === "adjust") setCustomMinutes("");
        setNotice(action === "save" ? "Progress saved. You can pause and close the app, then resume later."
          : action === "pause" ? "Timer paused. Elapsed time is saved; save progress to also save edited fields."
          : action === "reset" ? "Timer reset to 00:00:00 and paused. Reset saved; task details and start date kept."
          : action === "adjust" ? "Time adjustment saved." : "Timer running. Start time recorded.");
      }
      window.dispatchEvent(new Event("tasks-changed"));
    } catch (err) { setError((err as Error).message); }
    finally { requestBusy.current = false; setBusy(false); }
  }

  return (
    <div className="space-y-5">
      <section className="focus-banner rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4 text-white shadow-md">
        <div className="flex items-center gap-3 flex-1 min-w-60">
          <span className="rounded-xl bg-emerald-900/80 border border-emerald-700/50 text-emerald-300 p-3" aria-hidden="true">◷</span>
          <div><h1 className="text-xl font-bold">Active Focus Workbench</h1>
            <p className="text-xs text-emerald-200/70 mt-1">Work, pause, and resume at your pace. Live session time and dual-currency earnings.</p></div>
        </div>
        <div className="rounded-xl bg-emerald-900/50 border border-emerald-700/40 px-4 py-3 text-xs text-emerald-200">
          In Progress Task: <strong className="ml-2">{task ? `${task.name} · ${task.projectName ?? ""}` : "No task currently in progress"}</strong>
        </div>
      </section>
      {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
      {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
      {!loading && !task && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
        No task currently in progress. Use <strong>+ Log Task</strong> to create your next task, or return a task to In Progress on the <Link href="/" className="underline font-semibold">Task Board</Link>. It will appear here automatically.
      </div>}
      {loading ? <div className="card p-10 text-center text-muted">Loading your active task…</div> : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,0.7fr)_minmax(0,1fr)] gap-5 items-start">
          <section className="card focus-panel p-5 text-center">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">◷ Elapsed Task Duration</h2>
            <p aria-label="Elapsed task duration" className={`font-mono font-bold text-[clamp(2.5rem,5vw,4rem)] tracking-tight tabular-nums mt-3 ${running ? "text-emerald-700" : "text-slate-900"}`}>{clock(elapsedSeconds)}</p>
            <p className="chip bg-emerald-50 text-emerald-900 border border-emerald-200 mt-2">{Math.floor(minutes / 60)}h {minutes % 60}m logged ({minutes} minutes)</p>
            <div className="focus-earnings rounded-2xl border border-emerald-200 p-4 text-left mt-4 space-y-3">
              <div className="flex justify-between items-center gap-2"><h3 className="text-[0.65rem] font-bold uppercase text-emerald-950">🪙 Live Accrued Earnings</h3><span className="text-[0.55rem] text-slate-500 bg-white/80 rounded px-1.5 py-1">REAL-TIME COMPUTE</span></div>
              <p className="flex flex-wrap items-center justify-between gap-1 text-xs text-slate-600">USD Projected: <strong className="font-mono text-sm text-slate-900">{usdRangeText(usdMin, usdMax)}</strong></p>
              <p className="flex flex-wrap items-center justify-between gap-1 text-xs text-slate-600">INR Projected {rate > 0 ? `(@${formatRateINR(rate)}):` : ":"} <strong className="font-mono text-sm text-emerald-950">{rate > 0 ? inrRangeText(usdMin * rate, usdMax * rate) : "Rate unavailable"}</strong></p>
            </div>
            <div className="flex items-stretch gap-2 mt-3">
              <button disabled={busy || !task} className={`flex-1 min-w-0 py-3 rounded-xl font-semibold text-sm shadow-sm transition-colors disabled:opacity-50 ${running ? "bg-amber-100 text-amber-900 hover:bg-amber-200" : "bg-emerald-600 text-white hover:bg-emerald-700"}`} onClick={() => act(running ? "pause" : task?.startAt ? "resume" : "start")}>{running ? "Ⅱ Pause Timer" : task?.startAt ? "▶ Resume Timer" : "▶ Start Timer"}</button>
              <button disabled={busy || !task || (!running && milliseconds === 0)} onClick={() => act("reset")} title="Reset timer to 00:00:00" aria-label="Reset timer to 00:00:00" className="rounded-xl border border-slate-200 bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 text-sm font-semibold transition-colors disabled:opacity-40">
                <span aria-hidden="true">↺ </span>Reset
              </button>
            </div>
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 mt-4 flex flex-wrap justify-center items-center gap-2">
              <label htmlFor="custom-focus-minutes" className="text-xs text-muted">Custom minutes</label>
              <input id="custom-focus-minutes" type="number" min="1" max="1000000" step="1" value={customMinutes} onChange={(event) => setCustomMinutes(event.target.value)} className="field !w-24 !py-1.5 text-center" placeholder="min" />
              <button disabled={busy || !task || !validCustom} onClick={() => act("adjust", 1)} className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-3 py-2 disabled:opacity-40">+ Add</button>
              <button disabled={busy || !task || !validCustom} onClick={() => act("adjust", -1)} className="rounded-lg bg-rose-500 hover:bg-rose-600 text-white text-xs font-semibold px-3 py-2 disabled:opacity-40">− Deduct</button>
            </div>
            <p className="text-xs text-muted mt-3">Pause before taking a break. Paused time stays saved, even after closing the app.</p>
          </section>
          <section className="card focus-panel p-5 space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2"><span className="chip bg-emerald-100 text-emerald-950 border border-emerald-300">{task?.name ?? "—"}</span><h2 className="font-bold text-sm">Active Task Workbench</h2></div>
              <p className="text-xs text-muted mt-1">Edit fields here, then save progress or complete the task.</p>
            </div>
            <fieldset disabled={busy || !task} className="space-y-4 disabled:opacity-70">
              <legend className="sr-only">Active task details</legend>
              <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 border border-slate-200 p-1">
                {(["annotation", "review"] as const).map((type) => <button key={type} type="button" aria-pressed={form.taskType === type} onClick={() => edit("taskType", type)} className={`rounded-lg py-2 text-xs font-semibold ${form.taskType === type ? "bg-white border border-emerald-100 text-emerald-950 shadow-sm" : "text-slate-600"}`}>{type === "annotation" ? "📝 Annotation Task" : "🔍 Review Task"}</button>)}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="label">Task name<input type="text" maxLength={200} className="field mt-1.5" value={form.name} onChange={(event) => edit("name", event.target.value)} /></label>
                <label className="label">Project<select className="field mt-1.5" value={form.projectId} onChange={(event) => edit("projectId", event.target.value)}>{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select></label>
              </div>
              {review && <ReviewFields workerEmail={form.reviewWorkerEmail} justification={form.reviewJustification} feedback={form.taskerFeedback} onChange={edit} />}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  ["taskUuid", review ? "Session ID" : "Task UUID", "e.g. 32f78edc…"],
                  ["stageUuid", review ? "Pair ID" : "Stage UUID", "e.g. 30692a50…"],
                ] as const).map(([key, label, placeholder]) => (
                  <div key={key} className="min-w-0">
                    <label htmlFor={key} className="label">{label}</label>
                    <div className="flex items-center gap-2 mt-1.5">
                      <input id={key} className="field min-w-0 font-mono font-normal text-xs" value={form[key]}
                        onChange={event => edit(key, event.target.value)} placeholder={placeholder} />
                      <CopyButton label={label} value={form[key]} />
                    </div>
                  </div>
                ))}
              </div>
              <label className="label block">Task Context / Notes<textarea rows={3} className="field mt-1.5 font-normal" value={form.notes} onChange={(event) => edit("notes", event.target.value)} placeholder="e.g. Multi-turn reasoning, complex formatting…" /></label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="label">Start Date Time<input type="datetime-local" className="field mt-1.5 font-normal" readOnly value={form.startAt} onChange={(event) => edit("startAt", event.target.value)} /><span className="text-[0.65rem] text-muted font-normal">Recorded on the first timer start.</span></label>
                <label className="label">End Date Time<input aria-label="End Date Time" type="datetime-local" className="field mt-1.5 font-normal" readOnly value={toDateInputValue(task?.endAt)} /><span className="text-[0.65rem] text-muted font-normal">Recorded when you complete the task.</span></label>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <h3 className="text-[0.65rem] font-bold uppercase mb-3">🪙 {review ? "Review Hourly Rate" : "Task Hourly Rates (Min & Max)"}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="label">{review ? "Hourly Rate ($/hr)" : "Min Rate ($/hr – Base)"}<input type="number" min="0" step="0.01" className="field mt-1.5 !bg-white" value={form.minRate} onChange={(event) => edit("minRate", event.target.value)} /></label>
                  <label hidden={review} className="label">Max Rate ($/hr – Bonus)<input type="number" min="0" step="0.01" className="field mt-1.5 !bg-white" value={form.maxRate} onChange={(event) => edit("maxRate", event.target.value)} /></label>
                </div>
              </div>
              {review && <ReviewDecision value={form.taskerDecision} onChange={value => edit("taskerDecision", value)} />}
            </fieldset>
            <div className="border-t border-slate-100 pt-3 space-y-3">
              <p className="text-xs text-muted">{unsaved ? "Unsaved field changes · " : ""}Save stores elapsed time and task details. Completion records the end time.</p>
              <div className="flex flex-wrap gap-2">
                <button disabled={busy || !task} className="btn-ghost px-4 py-2 text-xs disabled:opacity-50" onClick={() => act("save")}>▣ Save Progress</button>
                <button disabled={busy || !task} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold px-4 py-2 text-xs shadow-sm disabled:opacity-50" onClick={() => act("complete")}>{review ? "✓ Complete Review" : "✓ Complete Task & Send to Review"}</button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
