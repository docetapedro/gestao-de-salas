import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

/**
 * Repõe o ranking de um evento a ZERO: apaga de TODAS as dinâmicas do evento as
 * respostas de quiz, os votos do Grito de Guerra e as tentativas do baú
 * (Caça ao Tesouro), faz reset do vencedor/abertura do baú, e apaga TODAS as
 * classificações (pontos lançados à mão + os automáticos de quiz/grito/tesouro).
 * Usar quando "Eliminar respostas" por dinâmica não chega — porque o ranking
 * soma a Classificacao, que também recebe pontos lançados manualmente e por isso
 * sobrevive à eliminação das respostas.
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

    const where = { dinamica: { eventoId: id } };
    const [respostas, votos, tentativas, classificacoes] =
      await prisma.$transaction([
        prisma.quizSubmissao.deleteMany({ where }),
        prisma.gritoVoto.deleteMany({ where }),
        prisma.tesouroTentativa.deleteMany({ where }),
        prisma.classificacao.deleteMany({ where }),
        // Reabre os baús (limpa vencedor/instante de abertura).
        prisma.dinamica.updateMany({
          where: { eventoId: id },
          data: { tesouroVencedorEquipaId: null, tesouroAbertoEm: null },
        }),
      ]);

    return json({
      ok: true,
      respostasApagadas: respostas.count,
      votosApagados: votos.count,
      tentativasApagadas: tentativas.count,
      classificacoesApagadas: classificacoes.count,
    });
  } catch (err) {
    return handleError(err);
  }
}
