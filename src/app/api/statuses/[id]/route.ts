import { eq } from "drizzle-orm";
import { db } from "@database/client";
import { statuses, tasks } from "@database/schema";
import { bad, ok, serverError } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const [status] = await db.select().from(statuses).where(eq(statuses.id, id));
    if (!status) return bad("Status not found", 404);
    if (status.isDefault)
      return bad("The default status cannot be deleted", 409);

    const inUse = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.statusId, id));
    if (inUse.length > 0)
      return bad(
        `${inUse.length} task(s) use this status. Reassign them first.`,
        409
      );

    await db.delete(statuses).where(eq(statuses.id, id));
    return ok({ deleted: true });
  } catch (err) {
    return serverError(err);
  }
}
