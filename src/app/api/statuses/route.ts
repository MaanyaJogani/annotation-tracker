import { asc, eq } from "drizzle-orm";
import { db } from "@database/client";
import { statuses } from "@database/schema";
import { bad, ok, serverError } from "@/lib/api";
import type { KanbanGroup } from "@/lib/types";

export async function GET() {
  try {
    const rows = await db
      .select()
      .from(statuses)
      .where(eq(statuses.isActive, true))
      .orderBy(asc(statuses.sortOrder));
    return ok(rows);
  } catch (err) {
    return serverError(err);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name ?? "").trim();
    const kanbanGroup = body.kanbanGroup as KanbanGroup;
    if (!name) return bad("Status name is required");
    if (!["in_progress", "completed", "paid"].includes(kanbanGroup))
      return bad("Invalid kanban group");

    const [{ max }] = await db
      .select({ max: statuses.sortOrder })
      .from(statuses)
      .orderBy(statuses.sortOrder);

    const [row] = await db
      .insert(statuses)
      .values({
        name,
        kanbanGroup,
        color: String(body.color ?? "#64748b"),
        sortOrder: (max ?? 0) + 1,
      })
      .returning();
    return ok(row, 201);
  } catch (err) {
    if (err instanceof Error && err.message.includes("unique"))
      return bad("A status with this name already exists", 409);
    return serverError(err);
  }
}
