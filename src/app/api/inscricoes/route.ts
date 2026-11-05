import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

/**
 * GET /api/inscricoes?q=
 * Lista as inscrições do workshop (área de administração). Filtra por texto
 * livre (nome, email ou telefone). Ordena da mais recente para a mais antiga.
 */
export async function GET(req: NextRequest) {
  try {
    assertCan(await getSession(), "inscricoes", "view");
    const { searchParams } = new URL(req.url);
    const q = (searchParams.get("q") || "").trim();

    const inscricoes = await prisma.workshopInscricao.findMany({
      where: q
        ? {
            OR: [
              { nome: { contains: q } },
              { email: { contains: q } },
              { telefone: { contains: q } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
    });

    return json({ inscricoes });
  } catch (err) {
    return handleError(err);
  }
}
