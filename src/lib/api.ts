import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 });
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export function serverError(err: unknown) {
  const message = err instanceof Error ? err.message : "Unexpected error";
  console.error("[api]", err);
  return NextResponse.json({ error: message }, { status: 500 });
}
