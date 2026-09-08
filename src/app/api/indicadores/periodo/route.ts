import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * POST /api/indicadores/periodo
 * Lança/actualiza os valores de um indicador para um ano/mês.
 * Body: { indicadorId, ano, mes, itens?: { [itemId]: valor }, valor? }.
 * Porta `Indicador::adicionarPeriodo()` — mas em upsert (idempotente): o valor
 * do período é sobrescrito e cada subitem substitui o valor desse mês.
 */
export async function POST(req: NextRequest) {
  try {
    assertCan(await getSession(), "indicadores", "manage");
    const body = await req.json();

    const indicadorId = String(body.indicadorId || body.indicador_id || "").trim();
    const ano = parseInt(String(body.ano), 10);
    const mes = parseInt(String(body.mes), 10);
    if (!indicadorId) return json({ error: "O indicador é obrigatório" }, 400);
    if (!ano || !mes) return json({ error: "Ano e mês são obrigatórios" }, 400);

    const itens: Record<string, unknown> =
      body.itens && typeof body.itens === "object" ? body.itens : {};
    const temItens = Object.keys(itens).length > 0;
    const temValor = body.valor !== undefined && body.valor !== null && body.valor !== "";

    if (!temItens && !temValor) {
      return json({ error: "Valor ou itens são obrigatórios" }, 400);
    }

    const valorBase = temItens ? 0 : num(body.valor);

    await prisma.$transaction(async (tx) => {
      // Valor do período (upsert por indicador+ano+mês).
      await tx.indicadorPeriodo.upsert({
        where: { indicadorId_ano_mes: { indicadorId, ano, mes } },
        update: { valor: valorBase },
        create: { indicadorId, ano, mes, valor: valorBase },
      });

      if (temItens) {
        for (const [itemId, valor] of Object.entries(itens)) {
          // Só aceita subitens que pertençam a este indicador.
          const item = await tx.indicadorItem.findFirst({
            where: { id: itemId, indicadorId },
            select: { id: true },
          });
          if (!item) continue;
          await tx.indicadorItemPeriodo.deleteMany({
            where: { itemId, ano, mes },
          });
          await tx.indicadorItemPeriodo.create({
            data: { itemId, ano, mes, valor: num(valor) },
          });
        }
      }
    });

    return json({ ok: true }, 201);
  } catch (err) {
    return handleError(err);
  }
}
