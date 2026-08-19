import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

// Lista os planos anuais existentes (mais recente primeiro).
export async function GET() {
  try {
    assertCan(await getSession(), "plano-formativo", "view");
    const planos = await prisma.pfPlano.findMany({ orderBy: { ano: "desc" } });
    return json({ planos });
  } catch (err) {
    return handleError(err);
  }
}

// Cria o plano de um ano.
export async function POST(req: NextRequest) {
  try {
    assertCan(await getSession(), "plano-formativo", "manage");
    const body = await req.json();
    const ano = Number(body.ano);
    if (!Number.isInteger(ano) || ano < 2000 || ano > 2100)
      return json({ error: "Ano inválido" }, 400);

    const existente = await prisma.pfPlano.findUnique({ where: { ano } });
    if (existente) return json({ error: `Já existe o plano de ${ano}` }, 409);

    const titulo = typeof body.titulo === "string" ? body.titulo.trim() || null : null;
    const plano = await prisma.pfPlano.create({ data: { ano, titulo } });
    return json({ plano }, 201);
  } catch (err) {
    return handleError(err);
  }
}
