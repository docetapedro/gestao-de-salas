import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { json, handleError } from "@/lib/http";
import { recomputarClassificacaoGrito } from "@/lib/gamificacao";

type Params = { params: Promise<{ id: string }> };

/**
 * Voto público num Grito de Guerra.
 * Body: { votanteEquipaId, votadaEquipaId }
 * Regras: 1 voto por equipa (o primeiro fixa-o); não se pode votar na própria
 * equipa; ambas as equipas têm de pertencer ao evento. Recalcula o vencedor.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();

    const votanteEquipaId = String(body.votanteEquipaId || "").trim();
    const votadaEquipaId = String(body.votadaEquipaId || "").trim();

    if (!votanteEquipaId) return json({ error: "Escolhe o teu grupo" }, 400);
    if (!votadaEquipaId) return json({ error: "Escolhe o grupo a votar" }, 400);
    if (votanteEquipaId === votadaEquipaId) {
      return json({ error: "Não podes votar no teu próprio grupo" }, 400);
    }

    const dinamica = await prisma.dinamica.findUnique({
      where: { id },
      select: { tipo: true, quizAberto: true, eventoId: true },
    });
    if (!dinamica || dinamica.tipo !== "grito") {
      return json({ error: "Votação não encontrada" }, 404);
    }
    if (!dinamica.quizAberto) {
      return json({ error: "A votação está fechada" }, 403);
    }

    // As duas equipas têm de existir e pertencer ao evento desta dinâmica.
    const equipas = await prisma.equipa.findMany({
      where: {
        eventoId: dinamica.eventoId,
        id: { in: [votanteEquipaId, votadaEquipaId] },
      },
      select: { id: true },
    });
    if (equipas.length !== 2) {
      return json({ error: "Grupo inválido" }, 400);
    }

    // 1 voto por equipa: o primeiro a votar fixa-o (unique dinamica+votante).
    try {
      await prisma.gritoVoto.create({
        data: { dinamicaId: id, votanteEquipaId, votadaEquipaId },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        return json(
          { error: "O teu grupo já votou. Só é permitido um voto por grupo." },
          409
        );
      }
      throw err;
    }

    // O voto é a fonte da verdade; se o recálculo falhar, o voto fica na mesma
    // registado e reconcilia no voto seguinte.
    try {
      await recomputarClassificacaoGrito(id);
    } catch (e) {
      console.error("Falha ao recalcular classificação do grito", {
        dinamicaId: id,
        erro: (e as Error).message,
      });
    }

    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
