import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

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
