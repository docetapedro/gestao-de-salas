import { NextResponse } from "next/server";
import { HttpError } from "./permissions";

export function json(data: unknown, init?: number | ResponseInit) {
  if (typeof init === "number") return NextResponse.json(data, { status: init });
  return NextResponse.json(data, init);
}

/** Converte erros (inclusive HttpError) numa resposta JSON consistente. */
export function handleError(err: unknown) {
  if (err instanceof HttpError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[API] erro inesperado:", err);
  const message =
    err instanceof Error ? err.message : "Erro interno do servidor";
  return NextResponse.json({ error: message }, { status: 500 });
}
