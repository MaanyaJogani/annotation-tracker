import { eq, sql } from "drizzle-orm";
import { db } from "@database/client";
import { projects, statuses, tasks } from "@database/schema";
import { bad, ok, serverError } from "@/lib/api";
import type { ApprovalStatus } from "@/lib/types";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const [row] = await db
      .select({
        task: tasks,
        projectName: projects.name,
        statusName: statuses.name,
        statusColor: statuses.color,
        statusKanbanGroup: statuses.kanbanGroup,
        statusShowOnBoard: statuses.showOnBoard,
      })
      .from(tasks)
      .leftJoin(projects, eq(tasks.projectId, projects.id))
      .leftJoin(statuses, eq(tasks.statusId, statuses.id))
      .where(eq(tasks.id, id));

    if (!row) return bad("Task not found", 404);
    const { task: t, ...status } = row;
    return ok({
      ...t,
      minRate: Number(t.minRate),
      maxRate: Number(t.maxRate),
      ...status,
    });
  } catch (err) {
    return serverError(err);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (body.projectId !== undefined) {
      const [project] = await db
        .select()
        .from(projects)
        .where(eq(projects.id, body.projectId));
      if (!project) return bad("Project not found", 404);
      updates.projectId = body.projectId;
    }
    if (body.taskUuid !== undefined) updates.taskUuid = String(body.taskUuid);
    if (body.stageUuid !== undefined) updates.stageUuid = String(body.stageUuid);
    if (body.timeSpentMinutes !== undefined) {
      const v = Math.round(Number(body.timeSpentMinutes));
      if (Number.isNaN(v) || v < 0) return bad("Invalid minutes");
      updates.timeSpentMinutes = v;
    }
    if (body.statusId !== undefined) updates.statusId = body.statusId || null;
    if (body.approvalStatus !== undefined) {
      if (!["pending", "accepted", "rejected"].includes(body.approvalStatus))
        return bad("Invalid approval status");
      updates.approvalStatus = body.approvalStatus as ApprovalStatus;
    }
    if (body.reviewerComment !== undefined)
      updates.reviewerComment = String(body.reviewerComment);
    if (body.startAt !== undefined)
      updates.startAt = body.startAt ? new Date(body.startAt) : null;
    if (body.endAt !== undefined)
      updates.endAt = body.endAt ? new Date(body.endAt) : null;
    if (body.minRate !== undefined) {
      const v = Number(body.minRate);
      if (Number.isNaN(v) || v < 0) return bad("Invalid min rate");
      updates.minRate = v.toFixed(2);
    }
    if (body.maxRate !== undefined) {
      const v = Number(body.maxRate);
      if (Number.isNaN(v) || v < 0) return bad("Invalid max rate");
      updates.maxRate = v.toFixed(2);
    }
    if (body.notes !== undefined) updates.notes = String(body.notes);

    const [row] = await db
      .update(tasks)
      .set(updates)
      .where(eq(tasks.id, id))
      .returning();

    if (!row) return bad("Task not found", 404);
    return ok({ ...row, minRate: Number(row.minRate), maxRate: Number(row.maxRate) });
  } catch (err) {
    return serverError(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const [row] = await db.delete(tasks).where(eq(tasks.id, id)).returning();
    if (!row) return bad("Task not found", 404);

    // If the board is now empty, restart numbering from Task 1.
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks);
    if (count === 0) {
      await db.execute(sql`ALTER TABLE tasks ALTER COLUMN task_number RESTART WITH 1`);
    }

    return ok({ deleted: true });
  } catch (err) {
    return serverError(err);
  }
}
