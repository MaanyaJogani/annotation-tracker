import { readPayment } from "./payment";
import { desc } from "drizzle-orm";
import { db } from "@database/client";
import { weeklyPayouts } from "@database/schema";
import { bad, ok, serverError } from "@/lib/api";

export async function GET() {
  try {
    return ok(await db.select({
      id: weeklyPayouts.id, weekNumber: weeklyPayouts.weekNumber, paidOn: weeklyPayouts.paidOn,
    }).from(weeklyPayouts).orderBy(desc(weeklyPayouts.weekNumber)));
  } catch (error) { return serverError(error); }
}

export async function POST(request: Request) {
  const payment = await readPayment(request);
  if (typeof payment === "string") return bad(payment);
  try {
    const [row] = await db.insert(weeklyPayouts).values(payment).returning();
    return ok(row, 201);
  } catch (error) { return serverError(error); }
}
