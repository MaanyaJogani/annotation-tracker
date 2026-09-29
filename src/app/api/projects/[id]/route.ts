import { and, eq, sql } from "drizzle-orm";
import { db } from "@database/client";
import { projects, tasks } from "@database/schema";
import { bad, ok, serverError } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = await request.json();
    const updates: Partial<{
      name: string;
      minRate: string;
      maxRate: string;
      updatedAt: Date;
    }> = { updatedAt: new Date() };

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) return bad("Project name is required");
      updates.name = name;
    }
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
    if (
      updates.minRate !== undefined &&
      updates.maxRate !== undefined &&
      Number(updates.minRate) > Number(updates.maxRate)
    )
      return bad("Min rate cannot exceed max rate");

    const [row] = await db
      .update(projects)
      .set(updates)
      .where(eq(projects.id, id))
      .returning();

    if (!row) return bad("Project not found", 404);
    return ok({ ...row, minRate: Number(row.minRate), maxRate: Number(row.maxRate) });
  } catch (err) {
    if (err instanceof Error && err.message.includes("unique"))
      return bad("A project with this name already exists", 409);
    return serverError(err);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tasks)
      .where(eq(tasks.projectId, id));

    if (count > 0)
      return bad(
        `This project has ${count} task(s). Reassign or delete them first.`,
        409
      );

    const [row] = await db
      .delete(projects)
      .where(and(eq(projects.id, id)))
      .returning();

    if (!row) return bad("Project not found", 404);
    return ok({ deleted: true });
  } catch (err) {
    return serverError(err);
  }
}
