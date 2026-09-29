import { eq } from "drizzle-orm";
import { db } from "@database/client";
import { tasks } from "@database/schema";
import { bad, ok, serverError } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };
type Action = "start" | "pause" | "resume" | "stop";

/** Server-authoritative timer transitions.
 *  start  : stamp start_at (if empty) + begin running
 *  pause  : bank elapsed minutes, stop running
 *  resume : begin running again (start_at untouched)
 *  stop   : bank elapsed minutes + stamp end_at, stop running */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const action = body.action as Action;
    if (!["start", "pause", "resume", "stop"].includes(action))
      return bad("Unknown timer action");

    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    if (!task) return bad("Task not found", 404);

    const now = new Date();
    const updates: Record<string, unknown> = { updatedAt: now };
    const running = task.timerStartedAt !== null;

    if (action === "start" || action === "resume") {
      if (running) return bad("Timer is already running", 409);
      updates.timerStartedAt = now;
      if (action === "start" && task.startAt === null) updates.startAt = now;
      if (action === "start") updates.endAt = null;
    } else {
      if (!running) return bad("Timer is not running", 409);
      const elapsedMs = now.getTime() - task.timerStartedAt!.getTime();
      const banked = Math.floor(elapsedMs / 60000);
      updates.timeSpentMinutes = task.timeSpentMinutes + banked;
      updates.timerStartedAt = null;
      if (action === "stop") updates.endAt = now;
    }

    const [row] = await db
      .update(tasks)
      .set(updates)
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
