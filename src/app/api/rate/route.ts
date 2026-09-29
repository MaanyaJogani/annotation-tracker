import { eq } from "drizzle-orm";
import { db } from "@database/client";
import { settings } from "@database/schema";
import { ok, serverError } from "@/lib/api";

const STALE_MS = 10 * 60 * 1000; // re-poll window (10 min)

async function fetchLiveRate(): Promise<{ rate: number; provider: string } | null> {
  // Primary: Frankfurter (ECB). Fallback: open.er-api.com.
  try {
    const res = await fetch(
      "https://api.frankfurter.dev/v1/latest?base=USD&symbols=INR",
      { cache: "no-store", signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const json = await res.json();
      const rate = Number(json?.rates?.INR);
      if (rate > 0) return { rate, provider: "frankfurter.dev" };
    }
  } catch {
    /* fall through */
  }
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (res.ok) {
      const json = await res.json();
      const rate = Number(json?.rates?.INR);
      if (rate > 0) return { rate, provider: "open.er-api.com" };
    }
  } catch {
    /* fall through */
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const force = new URL(request.url).searchParams.get("refresh") === "1";
    const [row] = await db.select().from(settings).where(eq(settings.id, 1));

    const manual = row?.rateSource === "manual";
    const cached = row?.usdInrRate ? Number(row.usdInrRate) : null;
    const age = row?.rateUpdatedAt
      ? Date.now() - new Date(row.rateUpdatedAt).getTime()
      : Infinity;

    if (manual) {
      return ok({
        rate: cached ?? 0,
        source: "manual" as const,
        updatedAt: row?.rateUpdatedAt ?? null,
        provider: "manual override",
      });
    }

    if (!force && cached !== null && age < STALE_MS) {
      return ok({
        rate: cached,
        source: "auto" as const,
        updatedAt: row?.rateUpdatedAt ?? null,
        provider: "cached",
      });
    }

    const live = await fetchLiveRate();
    if (live) {
      await db
        .update(settings)
        .set({
          usdInrRate: live.rate.toFixed(4),
          rateUpdatedAt: new Date(),
        })
        .where(eq(settings.id, 1));
      return ok({
        rate: live.rate,
        source: "auto" as const,
        updatedAt: new Date().toISOString(),
        provider: live.provider,
      });
    }

    // Both providers unreachable — serve stale cache if any
    if (cached !== null) {
      return ok({
        rate: cached,
        source: "auto" as const,
        updatedAt: row?.rateUpdatedAt ?? null,
        provider: "stale cache",
      });
    }
    return ok({ rate: null, source: "auto", updatedAt: null, provider: null });
  } catch (err) {
    return serverError(err);
  }
}
