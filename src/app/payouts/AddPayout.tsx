"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatRateINR } from "@/lib/format";

type Payment = { id: string; weekNumber: number; paidOn: string | null; notes: string; payoutUsd: string; payoutInr: string };

export default function AddPayout({ payment, onCreated }: {
  payment?: Payment;
  onCreated?: (week: { id: string; weekNumber: number; paidOn: string }) => void;
} = {}) {
  const titleId = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [usd, setUsd] = useState("");
  const [inr, setInr] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const rate = Number(usd) > 0 && inr !== "" ? formatRateINR(Number(inr) / Number(usd)) : "—";
  return <>
    <button className="ledger-primary" onClick={() => {
      setError("");
      dialog.current?.querySelector("form")?.reset();
      setUsd(payment?.payoutUsd ?? "");
      setInr(payment?.payoutInr ?? "");
      dialog.current?.showModal();
    }}>{payment ? "Edit payout" : "＋ Add payout"}</button>
    {payment && <button type="button" className="btn-ghost px-4 py-2 ml-2 text-red-700" disabled={saving} onClick={async () => {
      if (!window.confirm(`Delete Week ${payment.weekNumber}? Its tasks will lose their payout week. This cannot be undone.`)) return;
      setSaving(true);
      try {
        const response = await fetch(`/api/payouts/${payment.id}`, {method: "DELETE"});
        if (!response.ok) throw new Error((await response.json()).error);
        router.refresh();
      } catch { window.alert("Could not delete payout. Please try again."); }
      finally { setSaving(false); }
    }}>Delete payout</button>}
    <dialog ref={dialog} aria-labelledby={titleId} className="card payout-dialog text-foreground" onCancel={e => { if (saving) e.preventDefault(); }}>
      <form className="ledger-form" onSubmit={async event => {
        event.preventDefault();
        const form = event.currentTarget;
        setSaving(true);
        setError("");
        try {
          const response = await fetch(payment ? `/api/payouts/${payment.id}` : "/api/payouts", {method: payment ? "PATCH" : "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(Object.fromEntries(new FormData(form)))});
          if (!response.ok) throw new Error((await response.json()).error || "Could not save payout.");
          const week = await response.json();
          form.reset();
          setUsd(""); setInr("");
          dialog.current?.close();
          if (onCreated) onCreated(week);
          else router.refresh();
        } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not save payout."); }
        finally { setSaving(false); }
      }}>
        <div className="ledger-form-head">
          <div><span className="ledger-kicker">Payout ledger</span><h2 id={titleId}>{payment ? `Edit Week ${payment.weekNumber}` : "Record a payment"}</h2></div>
          <button type="button" disabled={saving} aria-label="Close payout form" onClick={() => dialog.current?.close()}>×</button>
        </div>
        <div className="ledger-form-body">
          <label className="ledger-date">Date paid<input className="field" required type="date" name="paidOn" defaultValue={payment?.paidOn ?? ""}/></label>
          <div className="ledger-amounts">
            <label>Paid in USD<span className="ledger-amount"><b>$</b><input required type="number" min=".01" max="9999999999.99" step=".01" name="payoutUsd" placeholder="0.00" value={usd} onChange={e => setUsd(e.target.value)}/></span></label>
            <label>Received in INR<span className="ledger-amount"><b>₹</b><input required type="number" min="0" max="9999999999.99" step=".01" name="payoutInr" placeholder="0.00" value={inr} onChange={e => setInr(e.target.value)}/></span></label>
          </div>
          <div className="ledger-rate"><span>Effective exchange rate</span><output>{rate === "—" ? "Enter both amounts" : `${rate} / USD`}</output></div>
          <label>Payment notes <span className="ledger-optional">Optional</span><textarea name="notes" defaultValue={payment?.notes ?? ""} className="field" rows={2} placeholder="Transaction reference or settlement details"/></label>
        </div>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <div className="ledger-actions"><button type="button" disabled={saving} className="btn-ghost px-4 py-2" onClick={() => dialog.current?.close()}>Cancel</button><button disabled={saving} className="ledger-primary">{saving ? "Saving…" : "Save payout"}</button></div>
      </form>
    </dialog>
  </>;
}
