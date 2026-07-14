import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertAuthenticated, assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

function normTipo(v: unknown): string {
  return String(v).toUpperCase() === "B2B" ? "B2B" : "B2C";
}

export async function GET() {
  try {
    assertAuthenticated(await getSession());
    const clientes = await prisma.cliente.findMany({ orderBy: { nome: "asc" } });
    return json({ clientes });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertCan(await getSession(), "cadastros", "manage");
    const body = await req.json();
    const nome = String(body.nome || "").trim();
    if (!nome) return json({ error: "Nome do cliente é obrigatório" }, 400);
    const cliente = await prisma.cliente.create({
      data: {
        nome,
        tipo: normTipo(body.tipo),
        telefone: body.telefone ? String(body.telefone).trim() : null,
        email: body.email ? String(body.email).trim() : null,
        descricao: body.descricao ? String(body.descricao).trim() : null,
      },
    });
    return json({ cliente }, 201);
  } catch (err) {
    return handleError(err);
  }
}
