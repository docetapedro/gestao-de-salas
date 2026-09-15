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

    await prisma.$transaction(async (tx) => {
      // Segmentos válidos (para não gravar colunas que não existem).
      const segIds = new Set(
        (await tx.perfSegmento.findMany({ select: { id: true } })).map((s) => s.id)
      );

      for (const l of linhas) {
        const indicadorId = String(l.indicadorId || "").trim();
        if (!indicadorId) continue;
        // Só aceita indicadores existentes.
        const ind = await tx.perfIndicador.findUnique({
          where: { id: indicadorId },
          select: { id: true },
        });
        if (!ind) continue;

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
        });

        // Substitui a desagregação por segmento deste registo.
        await tx.perfValorSegmento.deleteMany({ where: { valorId: valor.id } });
        const segs =
          l.segmentos && typeof l.segmentos === "object" ? l.segmentos : {};
        for (const [segmentoId, raw] of Object.entries(segs)) {
          if (!segIds.has(segmentoId)) continue;
          const quantidade = numOrNull(raw);
          if (quantidade === null) continue; // não guarda células vazias
          await tx.perfValorSegmento.create({
            data: { valorId: valor.id, segmentoId, quantidade },
          });
        }
      }
    });

    return json({ ok: true }, 201);
  } catch (err) {
    return handleError(err);
  }
}
