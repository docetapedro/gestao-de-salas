import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { json, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

/**
 * Leitura pública (sem login) de um Grito de Guerra para votar via QR Code.
 * Só devolve dados se a dinâmica for do tipo "grito". Indica se está aberto a
 * votos e devolve a lista de equipas. Não expõe os votos já emitidos.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const dinamica = await prisma.dinamica.findUnique({
      where: { id },
      include: { evento: { select: { nome: true, local: true } } },
    });

    if (!dinamica || dinamica.tipo !== "grito") {
      return json({ error: "Votação não encontrada" }, 404);
    }

    const equipas = await prisma.equipa.findMany({
      where: { eventoId: dinamica.eventoId },
      orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
      select: { id: true, nome: true, cor: true, lema: true },
    });

    return json({
      grito: {
        id: dinamica.id,
        nome: dinamica.nome,
        descricao: dinamica.descricao,
        aberto: dinamica.quizAberto,
        evento: dinamica.evento,
      },
      equipas,
    });
  } catch (err) {
    return handleError(err);
  }
}
