import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { json, handleError } from "@/lib/http";

// Leitura pública (sem sessão) do plano formativo para a VISÃO TRIMESTRAL.
// Devolve apenas formações + turmas (código/datas/estado/formador/contagem);
// NÃO expõe colaboradores nem necessidades individuais.
export async function GET(req: NextRequest) {
  try {
    const planos = await prisma.pfPlano.findMany({
      orderBy: { ano: "desc" },
      select: { ano: true, id: true },
    });

    const anoParam = Number(req.nextUrl.searchParams.get("ano"));
    const plano =
      (anoParam ? planos.find((p) => p.ano === anoParam) : null) ?? planos[0] ?? null;

    if (!plano) {
      return json({ ano: null, anos: [], formacoes: [] });
    }

    const [catalogo, turmas] = await Promise.all([
      prisma.pfFormacao.findMany({
        orderBy: { nome: "asc" },
        select: { id: true, nome: true, competencia: true },
      }),
      prisma.pfTurma.findMany({
        where: { planoId: plano.id },
        orderBy: [{ dataInicio: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          formacaoId: true,
          codigo: true,
          estado: true,
          entidade: true,
          formador: true,
          local: true,
          duracaoHoras: true,
          turno: true,
          dataInicio: true,
          dataFim: true,
          _count: { select: { inscricoes: true } },
        },
      }),
    ]);

    const turmasByFormacao = new Map<string, typeof turmas>();
    for (const t of turmas) {
      const arr = turmasByFormacao.get(t.formacaoId) ?? [];
      arr.push(t);
      turmasByFormacao.set(t.formacaoId, arr);
    }

    // Só formações que têm turmas neste ano (a grelha ignora as restantes).
    const formacoes = catalogo
      .map((f) => ({
        nome: f.nome,
        competencia: f.competencia,
        turmas: turmasByFormacao.get(f.id) ?? [],
      }))
      .filter((f) => f.turmas.length > 0);

    return json({
      ano: plano.ano,
      anos: planos.map((p) => p.ano),
      formacoes,
    });
  } catch (err) {
    return handleError(err);
  }
}
