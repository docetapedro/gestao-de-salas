import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertAuthenticated, assertCan, normPermissoes } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

export async function GET() {
  try {
    assertAuthenticated(await getSession());
    const perfis = await prisma.perfil.findMany({ orderBy: { nome: "asc" } });
    return json({ perfis });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertCan(await getSession(), "usuarios", "manage");
    const body = await req.json();
    const nome = String(body.nome || "").trim();
    if (!nome) return json({ error: "Nome do perfil é obrigatório" }, 400);
    const perfil = await prisma.perfil.create({
      data: {
        nome,
        descricao: body.descricao ? String(body.descricao).trim() : null,
        permissoes: JSON.stringify(normPermissoes(body.permissoes)),
      },
    });
    return json({ perfil }, 201);
  } catch (err) {
    return handleError(err);
  }
}
