import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "stock", "manage");
    const { id } = await params;
    const body = await req.json();
    const fornecedor = await prisma.fornecedor.update({
      where: { id },
      data: {
        nome: body.nome !== undefined ? String(body.nome).trim() : undefined,
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
    return json({ fornecedor });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "stock", "manage");
    const { id } = await params;
    await prisma.fornecedor.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
