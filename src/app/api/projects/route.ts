import { asc, eq, sql } from "drizzle-orm";
import { db } from "@database/client";
import { projects, tasks } from "@database/schema";
import { bad, ok, serverError } from "@/lib/api";

export async function GET() {
  try {
    const rows = await db
      .select({
        id: projects.id,
        name: projects.name,
        minRate: projects.minRate,
        maxRate: projects.maxRate,
        createdAt: projects.createdAt,
        updatedAt: projects.updatedAt,
        taskCount: sql<number>`count(${tasks.id})::int`,
      })
      .from(projects)
      .leftJoin(tasks, eq(tasks.projectId, projects.id))
      .groupBy(projects.id)
      .orderBy(asc(projects.createdAt));

    return ok(
      rows.map((r) => ({
        ...r,
        minRate: Number(r.minRate),
        maxRate: Number(r.maxRate),
      }))
    );
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const minRate = Number(body.minRate ?? 0);
    const maxRate = Number(body.maxRate ?? 0);

    if (!name) return bad("Project name is required");
    if (Number.isNaN(minRate) || Number.isNaN(maxRate) || minRate < 0 || maxRate < 0)
      return bad("Rates must be non-zero-positive numbers");
    if (maxRate > 0 && minRate > maxRate)
      return bad("Min rate cannot exceed max rate");

    const [row] = await db
      .insert(projects)
      .values({ name, minRate: minRate.toFixed(2), maxRate: maxRate.toFixed(2) })
      .returning();

    return ok(
      { ...row, minRate: Number(row.minRate), maxRate: Number(row.maxRate) },
      201
    );
  } catch (err) {
    if (err instanceof Error && err.message.includes("unique"))
      return bad("A project with this name already exists", 409);
    return serverError(err);
  }
}
