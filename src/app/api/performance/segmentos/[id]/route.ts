import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/performance/segmentos/[id]
 * Actualiza nome/ordem/ativo. Body: { nome?, ordem?, ativo? }.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "performance", "manage");
    const { id } = await params;
    const body = await req.json();

    const data: { nome?: string; ordem?: number; ativo?: boolean } = {};
    if (body.nome !== undefined) {
      const nome = String(body.nome).trim();
      if (!nome) return json({ error: "O nome é obrigatório" }, 400);
      data.nome = nome;
    }
    if (body.ordem !== undefined) data.ordem = Number(body.ordem);
    if (body.ativo !== undefined) data.ativo = Boolean(body.ativo);

    const segmento = await prisma.perfSegmento.update({ where: { id }, data });
    return json({ segmento });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * DELETE /api/performance/segmentos/[id]
 * Remove o segmento (e, em cascata, os seus valores por período).
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "performance", "manage");
    const { id } = await params;
    await prisma.perfSegmento.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
