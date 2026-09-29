import { desc, eq, sql } from "drizzle-orm";
import { db } from "@database/client";
import { projects, statuses, tasks } from "@database/schema";
import { bad, ok, serverError } from "@/lib/api";
import type { ApprovalStatus } from "@/lib/types";

export async function GET() {
  try {
    const rows = await db
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
      .orderBy(desc(tasks.taskNumber));

    return ok(
      rows.map(({ task: t, projectName, statusName, statusColor, statusKanbanGroup, statusShowOnBoard }) => ({
        ...t,
        minRate: Number(t.minRate),
        maxRate: Number(t.maxRate),
        projectName,
        statusName,
        statusColor,
        statusKanbanGroup,
        statusShowOnBoard,
      }))
    );
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const projectId = String(body.projectId ?? "");
    if (!projectId) return bad("Project is required");

    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));
    if (!project) return bad("Project not found", 404);

    // Default status = the one flagged is_default
    let statusId = body.statusId as string | undefined;
    if (!statusId) {
      const [def] = await db
        .select()
        .from(statuses)
        .where(eq(statuses.isDefault, true));
      statusId = def?.id;
    }

    const approvalStatus = (["pending", "accepted", "rejected"] as const).includes(
      body.approvalStatus
    )
      ? (body.approvalStatus as ApprovalStatus)
      : "pending";

    let taskNumber: number | undefined;
    if (body.taskNumber !== undefined) {
      const v = Math.round(Number(body.taskNumber));
      if (Number.isNaN(v) || v < 1) return bad("Invalid task number");
      const [dup] = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(eq(tasks.taskNumber, v));
      if (dup) return bad(`Task ${v} already exists`, 409);
      taskNumber = v;
    }

    const [row] = await db
      .insert(tasks)
      .values({
        ...(taskNumber !== undefined ? { taskNumber } : {}),
        projectId,
        taskUuid: String(body.taskUuid ?? ""),
        stageUuid: String(body.stageUuid ?? ""),
        statusId: statusId ?? null,
        approvalStatus,
        reviewerComment: String(body.reviewerComment ?? ""),
        startAt: body.startAt ? new Date(body.startAt) : null,
        endAt: body.endAt ? new Date(body.endAt) : null,
        timeSpentMinutes: Math.max(0, Math.round(Number(body.timeSpentMinutes ?? 0))),
        minRate:
          body.minRate !== undefined && Number(body.minRate) >= 0
            ? Number(body.minRate).toFixed(2)
            : project.minRate,
        maxRate:
          body.maxRate !== undefined && Number(body.maxRate) >= 0
            ? Number(body.maxRate).toFixed(2)
            : project.maxRate,
        notes: String(body.notes ?? ""),
      })
      .returning();

    // Keep auto-numbering ahead of any manually chosen number
    if (taskNumber !== undefined) {
      const [{ max }] = await db
        .select({ max: sql<number>`coalesce(max(task_number), 0)::int` })
        .from(tasks);
      await db.execute(
        sql.raw(`ALTER TABLE tasks ALTER COLUMN task_number RESTART WITH ${max + 1}`)
      );
    }

    return ok(
      { ...row, minRate: Number(row.minRate), maxRate: Number(row.maxRate) },
      201
    );
  } catch (err) {
    return serverError(err);
  }
}
