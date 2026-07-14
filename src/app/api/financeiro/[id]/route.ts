import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

// Remove um lançamento financeiro (uma rubrica de uma turma).
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "projetos", "manage");
    const { id } = await params;
    await prisma.financeiroItem.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
