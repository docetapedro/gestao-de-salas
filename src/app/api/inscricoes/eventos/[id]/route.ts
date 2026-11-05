import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

function dateTimeOrNull(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * GET /api/inscricoes/eventos/[id]
 * Devolve o evento e a lista de inscritos (mais recentes primeiro).
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "inscricoes", "view");
    const { id } = await params;
    const evento = await prisma.eventoInscricao.findUnique({
      where: { id },
      include: { inscricoes: { orderBy: { createdAt: "desc" } } },
    });
    if (!evento) return json({ error: "Evento não encontrado" }, 404);
    return json({ evento });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * PATCH /api/inscricoes/eventos/[id]
 * Actualiza os campos enviados do evento (inclui ligar/desligar inscrições).
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "inscricoes", "manage");
    const { id } = await params;
    const body = await req.json();

    const data: Record<string, unknown> = {};
    if (body.titulo !== undefined) {
      const titulo = String(body.titulo).trim();
      if (!titulo) return json({ error: "O nome do evento é obrigatório." }, 400);
      data.titulo = titulo;
    }
    if (body.tipo !== undefined) data.tipo = String(body.tipo).trim() || "Workshop";
    if (body.descricao !== undefined)
      data.descricao = String(body.descricao).trim() || null;
    if (body.local !== undefined) data.local = String(body.local).trim() || null;
    if (body.dataInicio !== undefined) data.dataInicio = dateTimeOrNull(body.dataInicio);
    if (body.ativo !== undefined) data.ativo = Boolean(body.ativo);

    const evento = await prisma.eventoInscricao.update({ where: { id }, data });
    return json({ evento });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * DELETE /api/inscricoes/eventos/[id]
 * Remove o evento e, em cascata, todas as inscrições.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "inscricoes", "manage");
    const { id } = await params;
    await prisma.eventoInscricao.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
