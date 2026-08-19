import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

// Payload da página para um ANO. As formações/colaboradores são partilhados
// entre anos; inscrições e turmas são do ano seleccionado. O RESUMO e as vistas
// por formação são calculados no cliente a partir destes dados.
export async function GET(req: NextRequest) {
  try {
    assertCan(await getSession(), "plano-formativo", "view");

    const planos = await prisma.pfPlano.findMany({ orderBy: { ano: "desc" } });

    // Ano pedido; senão o mais recente; senão nenhum (sem planos ainda).
    const anoParam = Number(req.nextUrl.searchParams.get("ano"));
    const plano =
      (anoParam ? planos.find((p) => p.ano === anoParam) : null) ?? planos[0] ?? null;

    if (!plano) {
      return json({ planos, ano: null, planoId: null, inscricoes: [], formacoes: [] });
    }

    const [inscricoes, catalogo, turmas] = await Promise.all([
      prisma.pfInscricao.findMany({
        where: { planoId: plano.id },
        orderBy: [{ formacao: { nome: "asc" } }, { colaborador: { nome: "asc" } }],
        include: {
          colaborador: {
            select: {
              id: true,
              nome: true,
              funcao: true,
              direcao: true,
              area: true,
              liderancaDirecta: true,
            },
          },
          formacao: {
            select: {
              id: true,
              nome: true,
              competencia: true,
              tipoAccao: true,
              pilar: true,
              area: true,
            },
          },
        },
      }),
      prisma.pfFormacao.findMany({ orderBy: { nome: "asc" } }),
      prisma.pfTurma.findMany({
        where: { planoId: plano.id },
        orderBy: [{ dataInicio: "asc" }, { createdAt: "asc" }],
        include: { _count: { select: { inscricoes: true } } },
      }),
    ]);

    // Contagens do ano por formação.
    const inscCount = new Map<string, number>();
    for (const i of inscricoes)
      inscCount.set(i.formacaoId, (inscCount.get(i.formacaoId) ?? 0) + 1);
    const turmasByFormacao = new Map<string, typeof turmas>();
    for (const t of turmas) {
      const arr = turmasByFormacao.get(t.formacaoId) ?? [];
      arr.push(t);
      turmasByFormacao.set(t.formacaoId, arr);
    }

    const formacoes = catalogo.map((f) => ({
      ...f,
      inscricoesCount: inscCount.get(f.id) ?? 0,
      turmas: turmasByFormacao.get(f.id) ?? [],
    }));

    return json({ planos, ano: plano.ano, planoId: plano.id, inscricoes, formacoes });
  } catch (err) {
    return handleError(err);
  }
}
