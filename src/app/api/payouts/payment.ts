export async function readPayment(request: Request) {
  const body = await request.json().catch(() => null);
  const amount = /^\d{1,10}(\.\d{1,2})?$/;
  if (!body || typeof body.paidOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.paidOn))
    return "Enter the date you received this payout.";
  const date = new Date(body.paidOn);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== body.paidOn)
    return "Enter a valid payment date.";
  if (![body.payoutUsd, body.payoutInr].every(v => typeof v === "string" && amount.test(v)) || Number(body.payoutUsd) <= 0)
    return "Enter a positive USD amount and a non-negative INR amount, with up to two decimal places.";
  if (typeof body.notes !== "string") return "Invalid notes.";
  return { paidOn: String(body.paidOn), payoutUsd: String(body.payoutUsd), payoutInr: String(body.payoutInr), notes: String(body.notes).trim() };
}
