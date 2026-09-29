import { eq, sql } from "drizzle-orm";
import { db } from "@database/client";
import { projects, settings, statuses, tasks, weeklyPayouts } from "@database/schema";
import { ok, serverError } from "@/lib/api";

/** Dashboard aggregates: counts, time, estimate ranges, approval rate,
 *  ledger totals (hero banner) and "by status" (Paid & Closed) totals. */
export async function GET() {
  try {
    const taskRows = await db
      .select({
        task: tasks,
        statusKanbanGroup: statuses.kanbanGroup,
        statusShowOnBoard: statuses.showOnBoard,
        projectName: projects.name,
      })
      .from(tasks)
      .leftJoin(statuses, eq(tasks.statusId, statuses.id))
      .leftJoin(projects, eq(tasks.projectId, projects.id));

    const [ledger] = await db
      .select({
        count: sql<number>`count(*)::int`,
        totalUsd: sql<string>`coalesce(sum(${weeklyPayouts.payoutUsd}), 0)`,
        totalInr: sql<string>`coalesce(sum(${weeklyPayouts.payoutInr}), 0)`,
      })
      .from(weeklyPayouts);

    const [rateRow] = await db
      .select({ usdInrRate: settings.usdInrRate })
      .from(settings)
      .where(eq(settings.id, 1))
      .limit(1);

    const rate = rateRow?.usdInrRate ? Number(rateRow.usdInrRate) : 0;

    const all = taskRows.map(({ task: t, statusKanbanGroup, statusShowOnBoard, projectName }) => ({
      ...t,
      minRate: Number(t.minRate),
      maxRate: Number(t.maxRate),
      statusKanbanGroup,
      statusShowOnBoard,
      projectName,
    }));

    const board = all.filter((t) => t.statusShowOnBoard !== false);
    const revoked = all.length - board.length;

    const ready = board.filter((t) => t.statusKanbanGroup === "completed").length;
    const paid = board.filter((t) => t.statusKanbanGroup === "paid").length;

    const totalMinutes = all.reduce((acc, t) => acc + t.timeSpentMinutes, 0);

    let usdMin = 0;
    let usdMax = 0;
    let minRateSeen = 0;
    let maxRateSeen = 0;
    for (const t of board) {
      const hours = t.timeSpentMinutes / 60;
      usdMin += hours * t.minRate;
      usdMax += hours * t.maxRate;
      minRateSeen = minRateSeen === 0 ? t.minRate : Math.min(minRateSeen, t.minRate);
      maxRateSeen = Math.max(maxRateSeen, t.maxRate);
    }

    let byStatusUsdMin = 0;
    let byStatusUsdMax = 0;
    for (const t of board) {
      if (t.statusKanbanGroup !== "paid") continue;
      const hours = t.timeSpentMinutes / 60;
      byStatusUsdMin += hours * t.minRate;
      byStatusUsdMax += hours * t.maxRate;
    }

    const reviewed = all.filter((t) => t.approvalStatus !== "pending");
    const accepted = reviewed.filter((t) => t.approvalStatus === "accepted").length;
    const approvalRate =
      reviewed.length === 0 ? null : Math.round((accepted / reviewed.length) * 100);

    return ok({
      totalTasks: all.length,
      ready,
      paid,
      revoked,
      totalMinutes,
      usdMin,
      usdMax,
      minRateSeen,
      maxRateSeen,
      rate,
      approvalRate,
      reviewedCount: reviewed.length,
      ledger: {
        count: ledger?.count ?? 0,
        totalUsd: Number(ledger?.totalUsd ?? 0),
        totalInr: Number(ledger?.totalInr ?? 0),
      },
      byStatusUsdMin,
      byStatusUsdMax,
    });
  } catch (err) {
    return serverError(err);
  }
}
