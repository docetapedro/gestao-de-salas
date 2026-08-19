import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

// Payload completo da página: inscrições (necessidades), formações (catálogo)
// com as suas turmas. O RESUMO e as vistas por formação são calculados no
// cliente a partir destes dados — fonte única, sem duplicação.
export async function GET() {
  try {
    assertCan(await getSession(), "plano-formativo", "view");

    const [inscricoes, formacoes] = await Promise.all([
      prisma.pfInscricao.findMany({
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
      prisma.pfFormacao.findMany({
        orderBy: { nome: "asc" },
        include: {
          turmas: {
            orderBy: [{ dataInicio: "asc" }, { createdAt: "asc" }],
            include: { _count: { select: { inscricoes: true } } },
          },
          _count: { select: { inscricoes: true } },
        },
      }),
    ]);

    return json({ inscricoes, formacoes });
  } catch (err) {
    return handleError(err);
  }
}
