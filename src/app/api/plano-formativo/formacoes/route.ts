import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

function str(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

// Cria uma formação no catálogo.
export async function POST(req: NextRequest) {
  try {
    assertCan(await getSession(), "plano-formativo", "manage");
    const body = await req.json();
    const nome = str(body.nome);
    if (!nome) return json({ error: "Nome da formação é obrigatório" }, 400);

    const existente = await prisma.pfFormacao.findUnique({ where: { nome } });
    if (existente) return json({ error: "Já existe uma formação com este nome" }, 409);

    const formacao = await prisma.pfFormacao.create({
      data: {
        nome,
        competencia: str(body.competencia),
        tipoAccao: str(body.tipoAccao),
        pilar: str(body.pilar),
        area: str(body.area),
        entidadeSugerida: str(body.entidadeSugerida),
        descricao: str(body.descricao),
      },
    });
    return json({ formacao }, 201);
  } catch (err) {
    return handleError(err);
  }
}
