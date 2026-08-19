import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";
import { buildPlanoFormativoWorkbook } from "@/lib/plano-formativo-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Descarrega o plano formativo de um ANO em .xlsx (Todos / RESUMO / Turmas +
// uma folha por formação).
export async function GET(req: NextRequest) {
  try {
    assertCan(await getSession(), "plano-formativo", "view");

    const planos = await prisma.pfPlano.findMany({ orderBy: { ano: "desc" } });
    const anoParam = Number(req.nextUrl.searchParams.get("ano"));
    const plano =
      (anoParam ? planos.find((p) => p.ano === anoParam) : null) ?? planos[0] ?? null;
    if (!plano) return json({ error: "Não há nenhum plano para exportar" }, 404);

    const turmaSelect = {
      codigo: true,
      estado: true,
      entidade: true,
      formador: true,
      local: true,
      modalidade: true,
      duracaoHoras: true,
      turno: true,
      dataInicio: true,
      dataFim: true,
    };

    const [inscricoes, catalogo, turmas] = await Promise.all([
      prisma.pfInscricao.findMany({
        where: { planoId: plano.id },
        orderBy: [{ formacao: { nome: "asc" } }, { colaborador: { nome: "asc" } }],
        include: {
          colaborador: {
            select: {
              nome: true,
              funcao: true,
              direcao: true,
              area: true,
              liderancaDirecta: true,
            },
          },
          formacao: {
            select: {
              nome: true,
              competencia: true,
              tipoAccao: true,
              pilar: true,
              entidadeSugerida: true,
            },
          },
          turma: { select: turmaSelect },
        },
      }),
      prisma.pfFormacao.findMany({ orderBy: { nome: "asc" } }),
      prisma.pfTurma.findMany({
        where: { planoId: plano.id },
        orderBy: [{ dataInicio: "asc" }, { createdAt: "asc" }],
        include: { _count: { select: { inscricoes: true } } },
      }),
    ]);

    // Contagens e turmas do ano por formação.
    const inscCount = new Map<string, number>();
    for (const i of inscricoes)
      inscCount.set(i.formacaoId, (inscCount.get(i.formacaoId) ?? 0) + 1);
    const turmasByFormacao = new Map<string, typeof turmas>();
    for (const t of turmas) {
      const arr = turmasByFormacao.get(t.formacaoId) ?? [];
      arr.push(t);
      turmasByFormacao.set(t.formacaoId, arr);
    }

    // Só as formações com inscrições OU turmas neste ano.
    const formacoes = catalogo
      .map((f) => ({
        nome: f.nome,
        competencia: f.competencia,
        tipoAccao: f.tipoAccao,
        pilar: f.pilar,
        _count: { inscricoes: inscCount.get(f.id) ?? 0 },
        turmas: turmasByFormacao.get(f.id) ?? [],
      }))
      .filter((f) => f._count.inscricoes > 0 || f.turmas.length > 0);

    const buffer = await buildPlanoFormativoWorkbook(inscricoes, formacoes);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="plano-formativo-${plano.ano}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
