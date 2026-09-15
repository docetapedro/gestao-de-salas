import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

const TIPOS = ["PERCENTAGEM", "NUMERO", "HORAS", "MOEDA", "PREVISTO_REALIZADO"];

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/performance/indicadores/[id]
 * Actualiza um indicador. Body: { titulo?, tipo?, usaHoras?, usaSegmentos?,
 * unidade?, ordem?, ativo? }.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "performance", "manage");
    const { id } = await params;
    const body = await req.json();

    const data: Record<string, unknown> = {};
    if (body.titulo !== undefined) {
      const titulo = String(body.titulo).trim();
      if (!titulo) return json({ error: "O título é obrigatório" }, 400);
      data.titulo = titulo;
    }
    if (body.tipo !== undefined && TIPOS.includes(body.tipo)) data.tipo = body.tipo;
    if (body.usaHoras !== undefined) data.usaHoras = Boolean(body.usaHoras);
    if (body.usaSegmentos !== undefined) data.usaSegmentos = Boolean(body.usaSegmentos);
    if (body.unidade !== undefined)
      data.unidade = body.unidade ? String(body.unidade).trim() || null : null;
    if (body.ordem !== undefined) data.ordem = Number(body.ordem);
    if (body.ativo !== undefined) data.ativo = Boolean(body.ativo);

    const indicador = await prisma.perfIndicador.update({ where: { id }, data });
    return json({ indicador });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * DELETE /api/performance/indicadores/[id]
 * Remove o indicador (e, em cascata, os seus valores por período).
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "performance", "manage");
    const { id } = await params;
    await prisma.perfIndicador.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
