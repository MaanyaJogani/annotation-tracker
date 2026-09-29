import { eq } from "drizzle-orm";
import { db } from "@database/client";
import { settings } from "@database/schema";
import { bad, ok, serverError } from "@/lib/api";

export async function GET() {
  try {
    const [row] = await db
      .select()
      .from(settings)
      .where(eq(settings.id, 1));
    return ok({
      workerEmail: row?.workerEmail ?? "",
      usdInrRate: row?.usdInrRate ? Number(row.usdInrRate) : null,
      rateSource: row?.rateSource ?? "auto",
      rateUpdatedAt: row?.rateUpdatedAt ?? null,
    });
  } catch (err) {
    return serverError(err);
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.workerEmail !== undefined)
      updates.workerEmail = String(body.workerEmail).trim();
    if (body.rateSource !== undefined) {
      if (!["auto", "manual"].includes(body.rateSource))
        return bad("Invalid rate source");
      updates.rateSource = body.rateSource;
    }
    if (body.usdInrRate !== undefined && body.usdInrRate !== null) {
      const v = Number(body.usdInrRate);
      if (Number.isNaN(v) || v <= 0) return bad("Invalid exchange rate");
      updates.usdInrRate = v.toFixed(4);
      updates.rateUpdatedAt = new Date();
    }

    await db.update(settings).set(updates).where(eq(settings.id, 1));
    const [row] = await db.select().from(settings).where(eq(settings.id, 1));

    return ok({
      workerEmail: row.workerEmail,
      usdInrRate: row.usdInrRate ? Number(row.usdInrRate) : null,
      rateSource: row.rateSource,
      rateUpdatedAt: row.rateUpdatedAt,
    });
  } catch (err) {
    return serverError(err);
  }
}
