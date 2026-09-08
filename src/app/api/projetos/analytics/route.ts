import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertAuthenticated } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";
import { calcularIndicadores } from "@/lib/projetos";

function parseDate(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/**
 * Dados acumulados de custos, receita e margem de todos os projectos.
 * Reutiliza `calcularIndicadores` (fonte única de cálculo do módulo) e agrega
 * os totais. Filtro opcional por período sobre a data de início do projecto:
 *   /api/projetos/analytics?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export async function GET(req: NextRequest) {
  try {
    assertAuthenticated(await getSession());
    const { searchParams } = new URL(req.url);
    const from = parseDate(searchParams.get("from"));
    const to = parseDate(searchParams.get("to"));

    const where =
      from || to
        ? {
            dataInicio: {
              ...(from ? { gte: from } : {}),
              ...(to ? { lte: endOfDay(to) } : {}),
            },
          }
        : {};

    const rows = await prisma.project.findMany({
      where,
      orderBy: [{ dataInicio: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        codigo: true,
        nome: true,
        dataInicio: true,
        dataFim: true,
        participantes: { select: { quantidade: true, concluidos: true } },
        financeiro: {
          select: {
            previsto: true,
            realizado: true,
            rubrica: { select: { tipo: true } },
          },
        },
      },
    });

    const projetos = rows.map((p) => {
      const ind = calcularIndicadores(p);
      return {
        id: p.id,
        codigo: p.codigo,
        nome: p.nome,
        dataInicio: p.dataInicio,
        dataFim: p.dataFim,
        inscritos: ind.inscritos,
        receita: ind.financeiro.receita,
        custo: ind.financeiro.custo,
        margem: ind.financeiro.margem,
        roiPct: ind.financeiro.roiPct,
      };
    });

    // Totais acumulados (previsto + realizado por dimensão).
    const zero = () => ({ previsto: 0, realizado: 0 });
    const totais = projetos.reduce(
      (acc, p) => {
        acc.receita.previsto += p.receita.previsto;
        acc.receita.realizado += p.receita.realizado;
        acc.custo.previsto += p.custo.previsto;
        acc.custo.realizado += p.custo.realizado;
        acc.margem.previsto += p.margem.previsto;
        acc.margem.realizado += p.margem.realizado;
        acc.inscritos += p.inscritos;
        return acc;
      },
      { receita: zero(), custo: zero(), margem: zero(), inscritos: 0 }
    );

    return json({ projetos, totais });
  } catch (err) {
    return handleError(err);
  }
}
