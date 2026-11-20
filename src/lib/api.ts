import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 });
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function serverError(err: unknown) {
  const cause = (err as { cause?: { constraint?: string; code?: string; message?: string } })?.cause ?? err as { constraint?: string; code?: string; message?: string };
  if (cause?.constraint === "tasks_one_active_focus")
    return bad("Only one task can be in progress. Complete the current task before starting another.", 409);
  if (cause?.code === "23514") return bad(cause.message ?? "Invalid task state");
  const message = err instanceof Error ? err.message : "Unexpected error";
  console.error("[api]", err);
  return NextResponse.json({ error: message }, { status: 500 });
}
