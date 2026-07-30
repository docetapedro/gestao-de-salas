import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

/**
 * Repõe o ranking de um evento a zero: apaga TODAS as respostas de quiz e TODAS
 * as classificações (pontos lançados à mão + derivados de quiz) de TODAS as
 * dinâmicas do evento. Usar quando "Eliminar respostas" por dinâmica não chega
 * — porque o ranking soma a Classificacao, que também recebe pontos lançados
 * manualmente e portanto sobrevive à eliminação das respostas.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "gamificacao", "manage");
    const { id } = await params;

    const evento = await prisma.teamBuildingEvento.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!evento) return json({ error: "Evento não encontrado" }, 404);

    const [respostas, classificacoes] = await prisma.$transaction([
      prisma.quizSubmissao.deleteMany({ where: { dinamica: { eventoId: id } } }),
      prisma.classificacao.deleteMany({ where: { dinamica: { eventoId: id } } }),
    ]);

    return json({
      ok: true,
      respostasApagadas: respostas.count,
      classificacoesApagadas: classificacoes.count,
    });
  } catch (err) {
    return handleError(err);
  }
}
