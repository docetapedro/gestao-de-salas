import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

/**
 * Actualiza um participante: associar/mover de equipa (`equipaId`, null = sem
 * equipa) e/ou renomear (`nome`).
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "gamificacao", "manage");
    const { id } = await params;
    const body = await req.json();

    const atual = await prisma.equipaMembro.findUnique({
      where: { id },
      include: { equipa: { select: { eventoId: true } } },
    });
    if (!atual) return json({ error: "Participante não encontrado" }, 404);
    const eventoId = atual.eventoId ?? atual.equipa?.eventoId ?? null;

    const data: { equipaId?: string | null; nome?: string; eventoId?: string } = {};

    if (body.equipaId !== undefined) {
      const equipaId =
        body.equipaId === null ? null : String(body.equipaId).trim() || null;
      if (equipaId) {
        const eq = await prisma.equipa.findUnique({
          where: { id: equipaId },
          select: { eventoId: true },
        });
        if (!eq || (eventoId && eq.eventoId !== eventoId)) {
          return json({ error: "Equipa inválida" }, 400);
        }
        // Garante o vínculo ao evento mesmo em registos antigos.
        data.eventoId = eq.eventoId;
      } else if (eventoId) {
        data.eventoId = eventoId;
      }
      data.equipaId = equipaId;
    }

    if (body.nome !== undefined) {
      const nome = String(body.nome).trim();
      if (!nome) return json({ error: "O nome não pode ficar vazio" }, 400);
      data.nome = nome;
    }

    const membro = await prisma.equipaMembro.update({ where: { id }, data });
    return json({ membro });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "gamificacao", "manage");
    const { id } = await params;
    // Idempotente: eliminações rápidas/repetidas (duplo-clique) não devem falhar
    // com P2025 se o registo já tiver sido apagado. deleteMany devolve count 0.
    await prisma.equipaMembro.deleteMany({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
