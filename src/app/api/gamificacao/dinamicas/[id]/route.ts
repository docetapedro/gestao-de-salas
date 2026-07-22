import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "gamificacao", "manage");
    const { id } = await params;
    const body = await req.json();
    let peso: number | undefined;
    if (body.peso !== undefined) {
      const p = Number(body.peso);
      peso = Number.isFinite(p) && p > 0 ? p : 1;
    }
    const dinamica = await prisma.dinamica.update({
      where: { id },
      data: {
        nome: body.nome !== undefined ? String(body.nome).trim() : undefined,
        descricao:
          body.descricao !== undefined
            ? body.descricao
              ? String(body.descricao).trim()
              : null
            : undefined,
        peso,
        ordem:
          body.ordem !== undefined ? Math.trunc(Number(body.ordem)) : undefined,
      },
    });
    return json({ dinamica });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "gamificacao", "manage");
    const { id } = await params;
    await prisma.dinamica.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
