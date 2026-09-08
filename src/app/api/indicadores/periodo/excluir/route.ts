import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

/**
 * POST /api/indicadores/periodo/excluir
 * Remove os dados lançados de um indicador num ano/mês: o valor do período e,
 * se composto, os valores dos subitens desse mês. Porta (e completa)
 * `Indicador::excluirPeriodo()`, que no PHP só apagava os subitens.
 * Body: { id (indicadorId), ano, mes }.
 */
export async function POST(req: NextRequest) {
  try {
    assertCan(await getSession(), "indicadores", "manage");
    const body = await req.json();

    const indicadorId = String(body.id || body.indicadorId || "").trim();
    const ano = parseInt(String(body.ano), 10);
    const mes = parseInt(String(body.mes), 10);
    if (!indicadorId || !ano || !mes) {
      return json({ error: "Indicador, ano e mês são obrigatórios" }, 400);
    }

    const removidos = await prisma.$transaction(async (tx) => {
      const itens = await tx.indicadorItemPeriodo.deleteMany({
        where: { ano, mes, item: { indicadorId } },
      });
      const periodo = await tx.indicadorPeriodo.deleteMany({
        where: { indicadorId, ano, mes },
      });
      return itens.count + periodo.count;
    });

    return json({ ok: true, removidos });
  } catch (err) {
    return handleError(err);
  }
}
