import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertAuthenticated, assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

export async function GET() {
  try {
    assertAuthenticated(await getSession());
    const eventos = await prisma.teamBuildingEvento.findMany({
      orderBy: [{ ativo: "desc" }, { createdAt: "desc" }],
      include: { _count: { select: { equipas: true, dinamicas: true } } },
    });
    return json({ eventos });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = assertCan(await getSession(), "gamificacao", "manage");
    const body = await req.json();
    const nome = String(body.nome || "").trim();
    if (!nome) return json({ error: "Nome do evento é obrigatório" }, 400);
    const evento = await prisma.teamBuildingEvento.create({
      data: {
        nome,
        descricao: body.descricao ? String(body.descricao).trim() : null,
        local: body.local ? String(body.local).trim() : null,
        data: body.data ? new Date(body.data) : null,
        createdById: session.sub,
      },
    });
    return json({ evento }, 201);
  } catch (err) {
    return handleError(err);
  }
}
