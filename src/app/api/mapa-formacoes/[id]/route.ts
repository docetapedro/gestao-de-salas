import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}
function floatOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function dateOrNull(v: unknown): Date | null {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  const d = new Date(`${s}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * PATCH /api/mapa-formacoes/[id]
 * Actualiza os campos enviados de uma formação do mapa.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "mapa-formacoes", "manage");
    const { id } = await params;
    const body = await req.json();

    const data: Record<string, unknown> = {};
    if (body.cliente !== undefined) {
      const cliente = String(body.cliente).trim();
      if (!cliente) return json({ error: "O cliente é obrigatório" }, 400);
      data.cliente = cliente;
    }
    if (body.accao !== undefined) {
      const accao = String(body.accao).trim();
      if (!accao) return json({ error: "A acção é obrigatória" }, 400);
      data.accao = accao;
    }
    if (body.tipoActividade !== undefined)
      data.tipoActividade = String(body.tipoActividade).trim() || "Formação";
    if (body.dataInicio !== undefined) data.dataInicio = dateOrNull(body.dataInicio);
    if (body.dataFim !== undefined) data.dataFim = dateOrNull(body.dataFim);
    if (body.previstos !== undefined) data.previstos = intOrNull(body.previstos);
    if (body.presentes !== undefined) data.presentes = intOrNull(body.presentes);
    if (body.concluiram !== undefined) data.concluiram = intOrNull(body.concluiram);
    if (body.cargaHoraria !== undefined) data.cargaHoraria = floatOrNull(body.cargaHoraria);

    const formacao = await prisma.mapaFormacao.update({ where: { id }, data });
    return json({ formacao });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * DELETE /api/mapa-formacoes/[id]
 * Remove uma formação do mapa.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "mapa-formacoes", "manage");
    const { id } = await params;
    await prisma.mapaFormacao.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
