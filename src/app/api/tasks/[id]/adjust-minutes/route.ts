import { eq } from "drizzle-orm";
import { db } from "@database/client";
import { tasks } from "@database/schema";
import { bad, ok, serverError } from "@/lib/api";
import { bankTime, elapsedMilliseconds } from "@/lib/focus-timer";

type Params = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const delta = Number(body.delta);
    if (!Number.isFinite(delta) || !Number.isInteger(delta) || Math.abs(delta) > 1000000) return bad("Enter a whole number of minutes, up to 1,000,000");
    const result = await db.transaction(async (tx) => {
      const [task] = await tx.select().from(tasks).where(eq(tasks.id, id)).for("update");
      if (!task) return null;
      if (!task.activeFocus) return "inactive" as const;
      const now = new Date();
      const [row] = await tx.update(tasks).set({
        ...bankTime(elapsedMilliseconds(task, now.getTime()) + delta * 60000),
        timerStartedAt: task.timerStartedAt ? now : null,
        updatedAt: now,
      }).where(eq(tasks.id, id)).returning();
      return row;
    });
    if (!result) return bad("Task not found", 404);
    if (result === "inactive") return bad("Only the in-progress task can have its focus time adjusted", 409);
    return ok({ ...result, minRate: Number(result.minRate), maxRate: Number(result.maxRate) });
  } catch (err) { return serverError(err); }
}
