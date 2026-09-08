import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

/**
 * GET /api/indicadores/[id]/itens
 * Subitens de um indicador (para o formulário de lançamento por período).
 * Porta `Indicador::itens()`.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "indicadores", "view");
    const { id } = await params;
    const itens = await prisma.indicadorItem.findMany({
      where: { indicadorId: id },
      orderBy: { id: "asc" },
      select: { id: true, nome: true },
    });
    return json({ itens });
  } catch (err) {
    return handleError(err);
  }
}
