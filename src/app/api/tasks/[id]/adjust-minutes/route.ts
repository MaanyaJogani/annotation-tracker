import { eq } from "drizzle-orm";
import { db } from "@database/client";
import { tasks } from "@database/schema";
import { bad, ok, serverError } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

/** Manual minute adjustments from workbench presets (+5m/+15m/−5m/−15m, custom). */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const delta = Math.round(Number(body.delta));
    if (Number.isNaN(delta)) return bad("Invalid delta");

    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!task) return bad("Task not found", 404);

    const next = Math.max(0, task.timeSpentMinutes + delta);
    const [row] = await db
      .update(tasks)
      .set({ timeSpentMinutes: next, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();

    return ok({
      ...row,
      minRate: Number(row.minRate),
      maxRate: Number(row.maxRate),
    });
  } catch (err) {
    return serverError(err);
  }
}
