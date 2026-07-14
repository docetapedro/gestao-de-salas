import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "cadastros", "manage");
    const { id } = await params;
    const body = await req.json();
    const rubrica = await prisma.rubricaTipo.update({
      where: { id },
      data: {
        nome: body.nome !== undefined ? String(body.nome).trim() : undefined,
        tipo:
          body.tipo !== undefined
            ? String(body.tipo).toUpperCase() === "RECEITA"
              ? "RECEITA"
              : "CUSTO"
            : undefined,
        ordem: body.ordem !== undefined ? Number(body.ordem) : undefined,
      },
    });
    return json({ rubrica });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "cadastros", "manage");
    const { id } = await params;
    await prisma.rubricaTipo.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
