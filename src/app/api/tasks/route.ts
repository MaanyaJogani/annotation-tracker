import { desc, eq } from "drizzle-orm";
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

    const [row] = await db
      .insert(tasks)
      .values({
        projectId,
        taskUuid: String(body.taskUuid ?? ""),
        stageUuid: String(body.stageUuid ?? ""),
        statusId: statusId ?? null,
        approvalStatus,
        reviewerComment: String(body.reviewerComment ?? ""),
        startAt: body.startAt ? new Date(body.startAt) : null,
        endAt: body.endAt ? new Date(body.endAt) : null,
        timeSpentMinutes: Math.max(0, Math.round(Number(body.timeSpentMinutes ?? 0))),
        minRate: project.minRate,
        maxRate: project.maxRate,
        notes: String(body.notes ?? ""),
      })
      .returning();

    return ok(
      { ...row, minRate: Number(row.minRate), maxRate: Number(row.maxRate) },
      201
    );
  } catch (err) {
    return serverError(err);
  }
}
