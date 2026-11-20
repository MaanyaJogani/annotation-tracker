import { formatUSD, formatINR } from "@/lib/format";
import type { ReactNode } from "react";

export default function PayoutHero({ ledger, children }: { ledger: { count: number; totalUsd: number; totalInr: number }; children: ReactNode }) {
  return (
      <section
        className="payout-hero rounded-2xl p-6 text-white shadow-lg"
      >
        <div className="flex items-center gap-4">
          <div className="payout-wallet rounded-xl bg-purple-800/60 border border-purple-500/40 text-purple-200 flex items-center justify-center shrink-0" aria-hidden="true">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 8V5H5a2 2 0 0 1 0-4h13v4M3 3v16a2 2 0 0 0 2 2h15V8H5a2 2 0 0 1-2-2" /><path d="M20 12h-5v5h5" /><path d="M17 14.5h.01" /></svg>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip bg-purple-900/80 border border-purple-500/50 text-purple-200">
                ◎ CUMULATIVE WEEKLY PAYOUTS RECEIVED
              </span>
              <span className="chip bg-purple-800/60 border border-purple-600/40 text-purple-200/90">
                {ledger.count} weekly payouts logged
              </span>
            </div>
            <div className="payout-totals mt-3 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                Total Paid USD:
              </span>
              <span className="text-3xl font-bold">{formatUSD(ledger.totalUsd)}</span>
              <span className="w-px h-6 bg-white/15 mx-2 hidden sm:block" />
              <span className="text-xs font-bold text-purple-300 uppercase tracking-wider">
                Total Paid INR:
              </span>
              <span className="text-3xl font-bold text-amber-300">{formatINR(ledger.totalInr)}</span>
            </div>
            <p className="payout-caption mt-3 text-purple-300/80 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              {children}
            </p>
          </div>
        </div>
      </section>
  );
}
