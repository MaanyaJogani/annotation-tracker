"use client";

type Props = {
  workerEmail: string; justification: string; feedback: string;
  onChange: (key: "reviewWorkerEmail" | "reviewJustification" | "taskerFeedback", value: string) => void;
};
export function ReviewFields({ workerEmail, justification, feedback, onChange }: Props) {
  return <div className="space-y-4 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4">
    <label className="label block">Worker Email (Tasker being reviewed)
      <input type="email" className="field mt-1.5" placeholder="worker@example.com" value={workerEmail} onChange={e => onChange("reviewWorkerEmail", e.target.value)} />
    </label>
    <label className="label block">Justification
      <span className="block text-xs font-normal text-muted mt-1">Reasoning for pass / fail</span>
      <textarea className="field mt-1.5" rows={4} placeholder="Explain accuracy, reasoning quality, constraint checks, and edge case coverage…" value={justification} onChange={e => onChange("reviewJustification", e.target.value)} />
    </label>
    <label className="label block">Tasker Feedback
      <span className="block text-xs font-normal text-muted mt-1">Actionable advice for the worker</span>
      <textarea className="field mt-1.5" rows={3} placeholder="Describe strengths, mistakes, and concrete ways to improve…" value={feedback} onChange={e => onChange("taskerFeedback", e.target.value)} />
    </label>
  </div>;
}
export function ReviewDecision({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <fieldset className="rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 space-y-3">
    <legend className="px-1 text-sm font-bold text-indigo-950">Review Decision (Final Step)</legend>
    <p className="text-xs text-muted">Decision for the reviewed worker. This does not affect your reviewer compensation. Leave unselected until you have evaluated the work.</p>
    <div className="grid grid-cols-2 gap-3">
      {(["pass", "fail"] as const).map(option => <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(value === option ? "" : option)} className={`rounded-xl border px-3 py-2.5 text-sm font-semibold ${option === "pass" ? `border-emerald-300 text-emerald-800 ${value === option ? "bg-emerald-100 ring-2 ring-emerald-500" : "bg-white"}` : `border-rose-300 text-rose-800 ${value === option ? "bg-rose-100 ring-2 ring-rose-500" : "bg-white"}`}`}>
        {option === "pass" ? "✓ Pass" : "× Fail"}
      </button>)}
    </div>
    <p className="text-xs text-center text-muted" role="status">{value ? `${value === "pass" ? "Pass" : "Fail"} selected. Click again to clear.` : "Unselected — choose Pass or Fail when ready."}</p>
  </fieldset>;
}
