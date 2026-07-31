import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";
import { apurarGrito, recomputarClassificacaoGrito } from "@/lib/gamificacao";

type Params = { params: Promise<{ id: string }> };

// Lista os votos de um grito (acompanhamento ao vivo no painel admin), com a
// contagem por equipa e o vencedor apurado (ou empate).
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "gamificacao", "view");
    const { id } = await params;
    const votos = await prisma.gritoVoto.findMany({
      where: { dinamicaId: id },
      orderBy: { createdAt: "asc" },
      include: {
        votanteEquipa: { select: { id: true, nome: true, cor: true } },
        votadaEquipa: { select: { id: true, nome: true, cor: true } },
      },
    });
    const apuramento = apurarGrito(votos);
    return json({ votos, apuramento });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Elimina votos de um grito. Body opcional `{ votoId }` elimina apenas esse;
 * sem `votoId` elimina TODOS os votos da dinâmica. Recalcula sempre o vencedor.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "gamificacao", "manage");
    const { id } = await params;

    let votoId = "";
    try {
      const body = await req.json();
      votoId = String(body?.votoId || "").trim();
    } catch {
      /* sem body = eliminar todos */
    }

    if (votoId) {
      const voto = await prisma.gritoVoto.findUnique({
        where: { id: votoId },
        select: { dinamicaId: true },
      });
      if (!voto || voto.dinamicaId !== id) {
        return json({ error: "Voto não encontrado" }, 404);
      }
      await prisma.gritoVoto.delete({ where: { id: votoId } });
    } else {
      await prisma.gritoVoto.deleteMany({ where: { dinamicaId: id } });
    }

    await recomputarClassificacaoGrito(id);
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
