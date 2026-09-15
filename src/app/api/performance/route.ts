import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

function intOrNull(v: string | null): number | null {
  if (v === null || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * GET /api/performance?ano=&mes=
 * Devolve o "quadro" mensal de Indicadores de Performance:
 *   - `indicadores`: catálogo activo (ordenado)
 *   - `segmentos`: colunas activas (ordenadas)
 *   - `valores`: mapa { [indicadorId]: { resultado, resultado2, horas,
 *     horasTotal, texto, segmentos: { [segmentoId]: quantidade } } } para o
 *     ano/mês pedido (vazio se ainda não houver lançamentos).
 * Tudo entrada manual — nada é calculado a partir de outros módulos.
 */
export async function GET(req: NextRequest) {
  try {
    assertCan(await getSession(), "performance", "view");
    const { searchParams } = new URL(req.url);
    const ano = intOrNull(searchParams.get("ano"));
    const mes = intOrNull(searchParams.get("mes"));

    const [indicadores, segmentos] = await Promise.all([
      prisma.perfIndicador.findMany({
        where: { ativo: true },
        orderBy: [{ ordem: "asc" }, { titulo: "asc" }],
      }),
      prisma.perfSegmento.findMany({
        where: { ativo: true },
        orderBy: [{ ordem: "asc" }, { nome: "asc" }],
      }),
    ]);

    const valores: Record<
      string,
      {
        resultado: number | null;
        resultado2: number | null;
        horas: number | null;
        horasTotal: number | null;
        texto: string | null;
        segmentos: Record<string, number | null>;
      }
    > = {};

    if (ano && mes) {
      const registos = await prisma.perfValor.findMany({
        where: { ano, mes },
        include: { segmentos: true },
      });
      for (const r of registos) {
        valores[r.indicadorId] = {
          resultado: r.resultado,
          resultado2: r.resultado2,
          horas: r.horas,
          horasTotal: r.horasTotal,
          texto: r.texto,
          segmentos: Object.fromEntries(
            r.segmentos.map((s) => [s.segmentoId, s.quantidade])
          ),
        };
      }
    }

    return json({ indicadores, segmentos, valores });
  } catch (err) {
    return handleError(err);
  }
}
