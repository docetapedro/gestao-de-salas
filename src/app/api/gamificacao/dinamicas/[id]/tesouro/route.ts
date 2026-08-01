import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";
import { reporTesouro } from "@/lib/tesouro-payload";

type Params = { params: Promise<{ id: string }> };

// Estado do baú + feed de tentativas (para a projeção e o acompanhamento admin).
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "gamificacao", "view");
    const { id } = await params;

    const dinamica = await prisma.dinamica.findUnique({
      where: { id },
      select: {
        tesouroAbertoEm: true,
        tesouroVencedor: { select: { id: true, nome: true, cor: true } },
      },
    });
    if (!dinamica) return json({ error: "Dinâmica não encontrada" }, 404);

    const tentativas = await prisma.tesouroTentativa.findMany({
      where: { dinamicaId: id },
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { equipa: { select: { id: true, nome: true, cor: true } } },
    });

    return json({
      vencedor: dinamica.tesouroVencedor,
      abertoEm: dinamica.tesouroAbertoEm,
      tentativas,
    });
  } catch (err) {
    return handleError(err);
  }
}

// Repõe o baú (limpa vencedor, tentativas e pontuação) para jogar outra ronda.
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "gamificacao", "manage");
    const { id } = await params;
    await reporTesouro(id);
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
