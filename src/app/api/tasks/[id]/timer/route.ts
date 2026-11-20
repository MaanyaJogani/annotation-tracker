import { eq, sql } from "drizzle-orm";
import { db } from "@database/client";
import { tasks, statuses, projects } from "@database/schema";
import { bad, ok, serverError } from "@/lib/api";
import { elapsedMilliseconds, bankTime } from "@/lib/focus-timer";

type Params = { params: Promise<{ id: string }> };
class InvalidAction extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

/** Atomic timer checkpoints. Pausing never stamps endAt; completion always does. */
export async function POST(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const action = body.action;
    if (!["start", "pause", "resume", "save", "complete", "reset"].includes(action)) return bad("Unknown timer action");
    const row = await db.transaction(async (tx) => {
      const [task] = await tx.select().from(tasks).where(eq(tasks.id, id)).for("update");
      if (!task) throw new InvalidAction("Task not found", 404);
      if (!task.activeFocus) throw new InvalidAction("Only the in-progress task belongs in Active Focus", 409);
      const now = new Date();
      const running = task.timerStartedAt !== null;
      const updates: Partial<typeof tasks.$inferInsert> = { updatedAt: now };
      if (action === "reset") {
        Object.assign(updates, bankTime(0));
        updates.timerStartedAt = null;
      } else if (action === "start" || action === "resume") {
        if (running) throw new InvalidAction("Timer is already running", 409);
        updates.timerStartedAt = now;
        updates.startAt = task.startAt ?? now;
        updates.endAt = null;
      } else {
        if (action === "pause" && !running) throw new InvalidAction("Timer is already paused", 409);
        Object.assign(updates, bankTime(elapsedMilliseconds(task, now.getTime())));
        updates.timerStartedAt = action === "save" && running ? now : null;
      }
      // Focus form changes and the time checkpoint commit together.
      if (action === "save" || action === "complete") {
        const fields = body.fields ?? {};
        if (fields.name !== undefined) {
          if (typeof fields.name !== "string" || fields.name.trim().length > 200) throw new InvalidAction("Task name must be text up to 200 characters");
          updates.name = fields.name.trim();
        }
        if (fields.taskNumber !== undefined) {
          if (!Number.isSafeInteger(fields.taskNumber) || fields.taskNumber < 1) throw new InvalidAction("Task number must be a positive whole number");
          const [duplicate] = await tx.select({ id: tasks.id }).from(tasks).where(eq(tasks.taskNumber, fields.taskNumber));
          if (duplicate && duplicate.id !== id) throw new InvalidAction("That task number already exists", 409);
          updates.taskNumber = fields.taskNumber;
        }
        if (fields.projectId !== undefined) {
          const [project] = await tx.select().from(projects).where(eq(projects.id, fields.projectId));
          if (!project) throw new InvalidAction("Project not found");
          updates.projectId = project.id;
        }
        for (const key of ["taskUuid", "stageUuid", "notes", "reviewWorkerEmail", "reviewJustification", "taskerFeedback"] as const) {
          if (fields[key] !== undefined) updates[key] = String(fields[key]);
        }
        for (const key of ["minRate", "maxRate"] as const) {
          if (fields[key] !== undefined) {
            const value = Number(fields[key]);
            if (!Number.isFinite(value) || value < 0 || value > 99999999.99) throw new InvalidAction("Rates must be valid non-negative amounts");
            updates[key] = value.toFixed(2);
          }
        }
        if ((fields.taskType ?? task.taskType) === "review") updates.maxRate = updates.minRate ?? task.minRate;
        if (Number(updates.maxRate ?? task.maxRate) < Number(updates.minRate ?? task.minRate)) throw new InvalidAction("Maximum rate must be at least the minimum rate");
        if (fields.taskType !== undefined) {
          if (!["annotation", "review"].includes(fields.taskType)) throw new InvalidAction("Invalid task type");
          updates.taskType = fields.taskType;
        }
        if (fields.taskerDecision !== undefined) {
          if (fields.taskerDecision !== null && !["pass", "fail"].includes(fields.taskerDecision)) throw new InvalidAction("Invalid tasker decision");
          updates.taskerDecision = fields.taskerDecision;
        }

      }
      if (action === "complete") {
        const completed = await tx.select().from(statuses).where(eq(statuses.kanbanGroup, "completed"));
        const status = completed.find((status) => status.showOnBoard && status.isActive);
        if (!status) throw new InvalidAction("Create an active Completed status before completing a task", 409);
        updates.statusId = status.id;
        updates.approvalStatus = "pending";
        updates.endAt = now;
      }
      const [result] = await tx.update(tasks).set(updates).where(eq(tasks.id, id)).returning();
      if (updates.taskNumber !== undefined) {
        const [{ max }] = await tx.select({ max: sql<number>`coalesce(max(task_number), 0)::int` }).from(tasks);
        await tx.execute(sql.raw(`ALTER TABLE tasks ALTER COLUMN task_number RESTART WITH ${max + 1}`));
      }
      return result;
    });
    return ok({ ...row, minRate: Number(row.minRate), maxRate: Number(row.maxRate) });
  } catch (err) {
    if (err instanceof InvalidAction) return bad(err.message, err.status);
    return serverError(err);
  }
}
