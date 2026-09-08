import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

/**
 * DELETE /api/indicadores/[id]
 * Apaga o indicador e, em cascata (onDelete: Cascade), os seus períodos,
 * subitens e valores de subitens. Porta `Indicador::delete()`.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "indicadores", "manage");
    const { id } = await params;
    await prisma.indicador.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
