import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    assertCanManage(await getSession());
    const { id } = await params;
    const body = await req.json();
    const cliente = await prisma.cliente.update({
      where: { id },
      data: {
        nome: body.nome !== undefined ? String(body.nome).trim() : undefined,
        tipo:
          body.tipo !== undefined
            ? String(body.tipo).toUpperCase() === "B2B"
              ? "B2B"
              : "B2C"
            : undefined,
        telefone:
          body.telefone !== undefined
            ? body.telefone
              ? String(body.telefone).trim()
              : null
            : undefined,
        email:
          body.email !== undefined
            ? body.email
              ? String(body.email).trim()
              : null
            : undefined,
        descricao:
          body.descricao !== undefined
            ? body.descricao
              ? String(body.descricao).trim()
              : null
            : undefined,
      },
    });
    return json({ cliente });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    assertCanManage(await getSession());
    const { id } = await params;
    await prisma.cliente.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
