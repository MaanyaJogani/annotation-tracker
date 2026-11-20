"use client";

import { useEffect, useRef, useState } from "react";
import AddPayout from "@/app/payouts/AddPayout";
import type { Task } from "@/lib/types";

type Week = { id: string; weekNumber: number; paidOn: string | null };

export default function AssignPayoutWeek({ task, onClose, onSaved }: {
  task: Task; onClose: () => void; onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [weeks, setWeeks] = useState<Week[] | null>(null);
  const [selected, setSelected] = useState(task.payoutId ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    dialog.current?.showModal();
    const controller = new AbortController();
    fetch("/api/payouts", {signal: controller.signal}).then(async response => {
      if (!response.ok) throw new Error();
      setWeeks(await response.json());
    }).catch(() => { if (!controller.signal.aborted) setError("Could not load payout weeks. Close and try again."); });
    return () => controller.abort();
  }, []);
  async function save() {
    setSaving(true);
    setError("");
    try {
      const response = await fetch(`/api/tasks/${task.id}`, {method: "PATCH", headers: {"Content-Type": "application/json"}, body: JSON.stringify({payoutId: selected || null})});
      if (!response.ok) throw new Error((await response.json()).error);
      onSaved();
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not save payout week.");
      setSaving(false);
    }
  }
  return <dialog ref={dialog} aria-labelledby="assign-week-heading" className="card payout-dialog" onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}>
    <div className="ledger-form-head"><div><span className="ledger-kicker">{task.name}</span><h2 id="assign-week-heading">Assign payout week</h2></div><button disabled={saving} onClick={onClose} aria-label="Close">×</button></div>
    <div className="ledger-form-body">
      {weeks === null && !error && <p role="status">Loading payout weeks…</p>}
      {weeks && (weeks.length ? <label>Payout week<select className="field" value={selected} onChange={e => setSelected(e.target.value)}>
        <option value="">Unassigned</option>
        {weeks.map(w => <option key={w.id} value={w.id}>Week {w.weekNumber}{w.paidOn && ` · ${w.paidOn}`}</option>)}
      </select></label> : <p>No payout weeks yet. Record your first payment to assign this task to Week 1.</p>)}
      {weeks && <div><AddPayout onCreated={week => { setWeeks([week, ...weeks]); setSelected(week.id); }}/></div>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </div>
    <div className="ledger-actions"><button className="btn-ghost" disabled={saving} onClick={onClose}>Cancel</button><button className="ledger-primary disabled:opacity-50" disabled={saving || !weeks || selected === (task.payoutId ?? "")} onClick={save}>{saving ? "Saving…" : "Save assignment"}</button></div>
  </dialog>;
}
