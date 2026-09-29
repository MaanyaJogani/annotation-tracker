/** Core payout math. All money math in plain numbers on minute/rate inputs;
 *  DB stores numeric strings — convert at the API boundary. */

export function projectedUsd(
  minutes: number,
  minRate: number,
  maxRate: number
): { min: number; max: number } {
  const hours = minutes / 60;
  return { min: hours * minRate, max: hours * maxRate };
}

export function projectedInr(
  minutes: number,
  minRate: number,
  maxRate: number,
  rate: number
): { min: number; max: number } {
  const usd = projectedUsd(minutes, minRate, maxRate);
  return { min: usd.min * rate, max: usd.max * rate };
}

/** "$266.67 – $300.00" */
export function usdRangeText(min: number, max: number): string {
  const f = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `$${f.format(min)} – $${f.format(max)}`;
}

/** "₹25,580 – ₹28,777" */
export function inrRangeText(min: number, max: number): string {
  const f = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
  return `₹${f.format(min)} – ₹${f.format(max)}`;
}
