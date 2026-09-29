import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

/** Converte para número ou null (campo vazio = sem valor). */
function numOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * POST /api/performance/valores
 * Grava (upsert) todo o quadro de um período de uma vez.
 * Body: { ano, mes, valores: [{ indicadorId, resultado, resultado2, horas,
 *         horasTotal, texto, segmentos?: { [segmentoId]: valor } }] }.
 * Para cada indicador faz upsert do PerfValor e substitui os valores por
 * segmento desse registo. Tudo entrada manual.
 */
export async function POST(req: NextRequest) {
  try {
    assertCan(await getSession(), "performance", "manage");
    const body = await req.json();

    const ano = parseInt(String(body.ano), 10);
    const mes = parseInt(String(body.mes), 10);
    if (!ano || !mes) return json({ error: "Ano e mês são obrigatórios" }, 400);

    const linhas: any[] = Array.isArray(body.valores) ? body.valores : [];

    await prisma.$transaction(
      async (tx) => {
        // IDs válidos carregados de uma só vez (evita 1 findUnique por linha e
        // permite ignorar colunas/indicadores que não existem).
        const [segRows0, indRows0] = await Promise.all([
          tx.perfSegmento.findMany({ select: { id: true } }),
          tx.perfIndicador.findMany({ select: { id: true } }),
        ]);
        const segIds = new Set(segRows0.map((s) => s.id));
        const indIds = new Set(indRows0.map((i) => i.id));

        const valorIds: string[] = [];
        const segRows: { valorId: string; segmentoId: string; quantidade: number }[] = [];

        for (const l of linhas) {
          const indicadorId = String(l.indicadorId || "").trim();
          if (!indicadorId || !indIds.has(indicadorId)) continue;

          const dados = {
            resultado: numOrNull(l.resultado),
            resultado2: numOrNull(l.resultado2),
            horas: numOrNull(l.horas),
            horasTotal: numOrNull(l.horasTotal),
            texto: l.texto ? String(l.texto).trim() || null : null,
          };

          const valor = await tx.perfValor.upsert({
            where: { indicadorId_ano_mes: { indicadorId, ano, mes } },
            update: dados,
            create: { indicadorId, ano, mes, ...dados },
            select: { id: true },
          });
          valorIds.push(valor.id);

          const segs =
            l.segmentos && typeof l.segmentos === "object" ? l.segmentos : {};
          for (const [segmentoId, raw] of Object.entries(segs)) {
            if (!segIds.has(segmentoId)) continue;
            const quantidade = numOrNull(raw);
            if (quantidade === null) continue; // não guarda células vazias
            segRows.push({ valorId: valor.id, segmentoId, quantidade });
          }
        }

        // Substitui a desagregação por segmento de todos os registos de uma vez
        // (1 deleteMany + 1 createMany em vez de N por linha).
        if (valorIds.length)
          await tx.perfValorSegmento.deleteMany({ where: { valorId: { in: valorIds } } });
        if (segRows.length)
          await tx.perfValorSegmento.createMany({ data: segRows });
      },
      { timeout: 20000, maxWait: 10000 }
    );

    return json({ ok: true }, 201);
  } catch (err) {
    return handleError(err);
  }
}
