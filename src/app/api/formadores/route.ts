import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertAuthenticated, assertCanManage } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

function normTipo(v: unknown): string {
  return String(v).toUpperCase() === "EXTERNO" ? "EXTERNO" : "INTERNO";
}

export async function GET() {
  try {
    assertAuthenticated(await getSession());
    const formadores = await prisma.formador.findMany({
      orderBy: { nome: "asc" },
    });
    return json({ formadores });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertCanManage(await getSession());
    const body = await req.json();
    const nome = String(body.nome || "").trim();
    if (!nome) return json({ error: "Nome do formador é obrigatório" }, 400);
    const formador = await prisma.formador.create({
      data: {
        nome,
        tipo: normTipo(body.tipo),
        telefone: body.telefone ? String(body.telefone).trim() : null,
        email: body.email ? String(body.email).trim() : null,
      },
    });
    return json({ formador }, 201);
  } catch (err) {
    return handleError(err);
  }
}
