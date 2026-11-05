import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

/**
 * DELETE /api/inscricoes/inscritos/[id]
 * Remove uma inscrição individual.
 */
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "inscricoes", "manage");
    const { id } = await params;
    await prisma.inscricao.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
