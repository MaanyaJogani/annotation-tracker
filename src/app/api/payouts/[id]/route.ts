import { eq } from "drizzle-orm";
import { db } from "@database/client";
import { weeklyPayouts } from "@database/schema";
import { bad, ok, serverError } from "@/lib/api";
import { readPayment } from "../payment";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const payment = await readPayment(request);
  if (typeof payment === "string") return bad(payment);
  try {
    const { id } = await params;
    const [row] = await db.update(weeklyPayouts).set(payment).where(eq(weeklyPayouts.id, id)).returning();
    return row ? ok(row) : bad("Payout not found", 404);
  } catch (error) { return serverError(error); }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const [row] = await db.delete(weeklyPayouts).where(eq(weeklyPayouts.id, id)).returning({id: weeklyPayouts.id});
    return row ? ok(row) : bad("Payout not found", 404);
  } catch (error) { return serverError(error); }
}
