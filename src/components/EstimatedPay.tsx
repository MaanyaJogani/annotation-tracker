import { formatRateINR } from "@/lib/format";
import { approvalAdjustedUsd, inrRangeText, usdRangeText } from "@/lib/payout";

interface Props {
  usd: { min: number; max: number };
  rate: number;
  paid?: boolean;
  showRate?: boolean;
  approvalStatus?: string;
  basisLabel?: string;
}

export default function EstimatedPay({ usd, rate, paid = false, showRate = false, approvalStatus = "pending", basisLabel }: Props) {
  const amount = approvalAdjustedUsd(usd, approvalStatus);
  return (
    <div className="task-earnings" data-paid={paid}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{paid ? "Payout" : "Estimated pay"}</p>
        {basisLabel && <span className="ml-auto text-right text-xs font-medium text-slate-500">{basisLabel}</span>}
      </div>
      <div className="grid grid-cols-2 gap-4 mt-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">USD</p>
          <p className="task-pay-value">{usdRangeText(amount.min, amount.max)}</p>
        </div>
        <div className="min-w-0 border-l border-slate-200 pl-4">
          <p className="text-xs font-medium text-slate-500">INR</p>
          <p className="task-pay-value">{rate > 0 ? inrRangeText(amount.min * rate, amount.max * rate) : "—"}</p>
        </div>
      </div>
      {showRate && rate > 0 && (
        <p className="mt-3 text-xs text-slate-500">Exchange rate: {formatRateINR(rate)}/USD</p>
      )}
    </div>
  );
}
