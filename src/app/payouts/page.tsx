import { desc, eq, isNotNull } from "drizzle-orm";
import { db } from "@database/client";
import { weeklyPayouts, tasks, projects } from "@database/schema";
import { formatUSD, formatRateINR, formatMinutesChip } from "@/lib/format";
import PayoutHero from "@/components/PayoutHero";
import AddPayout from "./AddPayout";

export const dynamic = "force-dynamic";
const rupees = new Intl.NumberFormat("en-IN", {style: "currency", currency: "INR", minimumFractionDigits: 0, maximumFractionDigits: 2});
const date = new Intl.DateTimeFormat("en-GB", {dateStyle: "medium", timeZone: "UTC"});
function rate(usd: number, inr: number) {
  return usd > 0 ? formatRateINR(inr / usd) : "—";
}

export default async function PayoutLedger() {
  const [weeks, linked] = await Promise.all([
    db.select().from(weeklyPayouts).orderBy(desc(weeklyPayouts.weekNumber)),
    db.select({ id: tasks.id, week: tasks.payoutId, name: tasks.name, number: tasks.taskNumber, project: projects.name, minutes: tasks.timeSpentMinutes, type: tasks.taskType })
      .from(tasks).innerJoin(projects, eq(tasks.projectId, projects.id)).where(isNotNull(tasks.payoutId)).orderBy(desc(tasks.taskNumber)),
  ]);
  const totals = weeks.reduce((sum, w) => ({usd: sum.usd + Number(w.payoutUsd), inr: sum.inr + Number(w.payoutInr)}), {usd: 0, inr: 0});
  return <div className="space-y-6">
    <PayoutHero ledger={{count: weeks.length, totalUsd: totals.usd, totalInr: totals.inr}}>
      {totals.usd > 0 ? `Effective rate · ${rate(totals.usd, totals.inr)} per USD` : "Effective rate appears after your first payment"}
    </PayoutHero>
    <section><header className="ledger-heading"><div><h1 className="text-2xl font-bold">Payout Ledger</h1><p className="text-sm text-muted mt-1">Weekly payments and linked tasks</p></div><AddPayout /></header>
      {!weeks.length && <div className="card py-12 px-5 text-center"><span className="summary-icon" aria-hidden>₹</span><h3 className="font-bold mt-3">No payouts recorded yet</h3><p className="mt-1 text-sm text-muted">Add your first payout to start Week 1.</p></div>}
      <div className="space-y-3">{weeks.map(w => {
        const rows = linked.filter(t => t.week === w.id);
        return <details className="card task-card ledger-week" key={w.id}>
          <summary className="ledger-row cursor-pointer">
            <div><h3 className="font-bold">Week {w.weekNumber}</h3><span className="text-sm text-muted">{w.paidOn ? date.format(new Date(w.paidOn)) : "Payment date unavailable"}</span></div>
            <div><small>Paid in USD</small><strong>{formatUSD(Number(w.payoutUsd))}</strong></div>
            <div><small>Received in INR</small><strong className="text-emerald-800">{rupees.format(Number(w.payoutInr))}</strong></div>
            <div><small>Effective rate</small><strong>{rate(Number(w.payoutUsd), Number(w.payoutInr))} / USD</strong></div>
            <span aria-hidden className="ledger-chevron">⌄</span>
          </summary>
          <div className="border-t border-line pt-4 space-y-4">
            <div><AddPayout payment={w} /></div>
            {w.notes && <div><h4 className="label">Notes</h4><p className="text-sm whitespace-pre-wrap break-words">{w.notes}</p></div>}
            <h4 className="font-semibold">Linked tasks · {rows.length}</h4>
            {rows.length ? <div className="overflow-x-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-50 text-muted"><tr>{["Task","Project","Type","Time"].map(h => <th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{rows.map(t => <tr key={t.id} className="border-t border-line"><td className="p-2 font-medium">{t.name || `Task ${t.number}`}</td><td className="p-2">{t.project}</td><td className="p-2 capitalize">{t.type}</td><td className="p-2">{formatMinutesChip(t.minutes)}</td></tr>)}</tbody></table></div> : <p className="text-sm text-muted">Select Week {w.weekNumber} in a task’s payout week field to link it here.</p>}
          </div>
        </details>;
      })}</div>
    </section>
  </div>;
}
