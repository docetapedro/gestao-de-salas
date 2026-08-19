import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { handleError } from "@/lib/http";
import { buildPlanoFormativoWorkbook } from "@/lib/plano-formativo-export";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Descarrega o plano formativo em .xlsx (folhas Todos / RESUMO / Turmas).
export async function GET() {
  try {
    assertCan(await getSession(), "plano-formativo", "view");

    const turmaSelect = {
      codigo: true,
      estado: true,
      entidade: true,
      formador: true,
      local: true,
      modalidade: true,
      dataInicio: true,
      dataFim: true,
    };

    const [inscricoes, formacoes] = await Promise.all([
      prisma.pfInscricao.findMany({
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
      prisma.pfFormacao.findMany({
        orderBy: { nome: "asc" },
        include: {
          _count: { select: { inscricoes: true } },
          turmas: {
            orderBy: [{ dataInicio: "asc" }, { createdAt: "asc" }],
            select: { ...turmaSelect, _count: { select: { inscricoes: true } } },
          },
        },
      }),
    ]);

    const buffer = await buildPlanoFormativoWorkbook(inscricoes, formacoes);
    const data = new Date().toISOString().slice(0, 10);

    return new Response(new Uint8Array(buffer), {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="plano-formativo-${data}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
