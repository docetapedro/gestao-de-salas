import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";
import { recomputarClassificacaoQuiz } from "@/lib/gamificacao";

type Params = { params: Promise<{ id: string }> };

// Lista as submissões de um quiz (para acompanhamento ao vivo no painel admin).
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "gamificacao", "view");
    const { id } = await params;
    const submissoes = await prisma.quizSubmissao.findMany({
      where: { dinamicaId: id },
      orderBy: [{ pontos: "desc" }, { createdAt: "asc" }],
      include: { equipa: { select: { nome: true, cor: true } } },
    });
    return json({ submissoes });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Elimina respostas de um quiz. Body opcional `{ submissaoId }` elimina apenas
 * essa; sem `submissaoId` elimina TODAS as respostas da dinâmica (limpar testes).
 * Recalcula sempre a classificação das equipas afectadas.
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "gamificacao", "manage");
    const { id } = await params;

    let submissaoId = "";
    try {
      const body = await req.json();
      submissaoId = String(body?.submissaoId || "").trim();
    } catch {
      /* sem body = eliminar todas */
    }

    if (submissaoId) {
      const sub = await prisma.quizSubmissao.findUnique({
        where: { id: submissaoId },
        select: { equipaId: true, dinamicaId: true },
      });
      if (!sub || sub.dinamicaId !== id) {
        return json({ error: "Resposta não encontrada" }, 404);
      }
      await prisma.quizSubmissao.delete({ where: { id: submissaoId } });
      await recomputarClassificacaoQuiz(id, sub.equipaId);
      return json({ ok: true });
    }

    // Eliminar todas: apaga submissões e limpa as classificações desta dinâmica.
    await prisma.$transaction([
      prisma.quizSubmissao.deleteMany({ where: { dinamicaId: id } }),
      prisma.classificacao.deleteMany({ where: { dinamicaId: id } }),
    ]);
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
