import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertAuthenticated, assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";
import { rankingEvento } from "@/lib/gamificacao";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    assertAuthenticated(await getSession());
    const { id } = await params;
    const evento = await prisma.teamBuildingEvento.findUnique({
      where: { id },
      include: {
        equipas: {
          orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
          include: { membros: { orderBy: { nome: "asc" } } },
        },
        dinamicas: {
          orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
          include: {
            classificacoes: true,
            perguntas: {
              orderBy: { ordem: "asc" },
              include: { opcoes: { orderBy: { ordem: "asc" } } },
            },
            submissoes: { orderBy: { createdAt: "desc" } },
          },
        },
      },
    });
    if (!evento) return json({ error: "Evento não encontrado" }, 404);
    const ranking = await rankingEvento(id);
    return json({ evento, ranking });
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "gamificacao", "manage");
    const { id } = await params;
    const body = await req.json();
    const evento = await prisma.teamBuildingEvento.update({
      where: { id },
      data: {
        nome: body.nome !== undefined ? String(body.nome).trim() : undefined,
        descricao:
          body.descricao !== undefined
            ? body.descricao
              ? String(body.descricao).trim()
              : null
            : undefined,
        local:
          body.local !== undefined
            ? body.local
              ? String(body.local).trim()
              : null
            : undefined,
        data:
          body.data !== undefined
            ? body.data
              ? new Date(body.data)
              : null
            : undefined,
        ativo: body.ativo !== undefined ? Boolean(body.ativo) : undefined,
      },
    });
    return json({ evento });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "gamificacao", "manage");
    const { id } = await params;
    await prisma.teamBuildingEvento.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
