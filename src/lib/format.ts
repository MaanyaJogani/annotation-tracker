const usd = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const usd0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

export function formatUSD(value: number, decimals = 2): string {
  if (decimals === 0) return `$${usd0.format(value)}`;
  return `$${usd.format(value)}`;
}

export function formatINR(value: number): string {
  return `₹${inr.format(value)}`;
}

export function formatRateINR(value: number): string {
  return `₹${value.toFixed(2)}`;
}

/** "1h 11m (71m)" style chip text */
export function formatMinutesChip(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hPart = h > 0 ? `${h}h ` : "";
  return `${hPart}${m}m (${minutes}m)`;
}

/** "21.7 hrs (1302 mins)" style summary */
export function formatHoursSummary(minutes: number): string {
  const hrs = minutes / 60;
  return `${hrs.toFixed(1)} hrs (${minutes} mins)`;
}

/** "3.33 hours" hint under the minutes input */
export function formatHoursHint(minutes: number): string {
  return `= ${(minutes / 60).toFixed(2)} hours`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function toDateInputValue(value: string | null | undefined): string {
  if (!value) return "";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function fromDateInputValue(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}
