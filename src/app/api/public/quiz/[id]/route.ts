import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { json, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

/**
 * Leitura pública (sem login) de um quiz para responder via QR Code.
 * Só devolve os dados se a dinâmica for do tipo "quiz". As opções NÃO incluem
 * o gabarito (`correta`). Indica se o quiz está aberto a respostas.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const dinamica = await prisma.dinamica.findUnique({
      where: { id },
      include: {
        evento: { select: { nome: true, local: true } },
        perguntas: {
          orderBy: { ordem: "asc" },
          include: {
            opcoes: {
              orderBy: { ordem: "asc" },
              select: { id: true, texto: true },
            },
          },
        },
      },
    });

    if (!dinamica || dinamica.tipo !== "quiz") {
      return json({ error: "Questionário não encontrado" }, 404);
    }

    const equipas = await prisma.equipa.findMany({
      where: { eventoId: dinamica.eventoId },
      orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        nome: true,
        cor: true,
        membros: { orderBy: { nome: "asc" }, select: { nome: true } },
      },
    });

    return json({
      quiz: {
        id: dinamica.id,
        nome: dinamica.nome,
        descricao: dinamica.descricao,
        aberto: dinamica.quizAberto,
        tempoLimiteSeg: dinamica.tempoLimiteSeg,
        evento: dinamica.evento,
        perguntas: dinamica.perguntas.map((p) => ({
          id: p.id,
          enunciado: p.enunciado,
          opcoes: p.opcoes,
        })),
      },
      equipas,
    });
  } catch (err) {
    return handleError(err);
  }
}
