import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan, normPermissoes } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "usuarios", "manage");
    const { id } = await params;
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.nome !== undefined) data.nome = String(body.nome).trim();
    if (body.descricao !== undefined)
      data.descricao = body.descricao ? String(body.descricao).trim() : null;
    if (body.permissoes !== undefined)
      data.permissoes = JSON.stringify(normPermissoes(body.permissoes));
    const perfil = await prisma.perfil.update({ where: { id }, data });
    return json({ perfil });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "usuarios", "manage");
    const { id } = await params;
    const perfil = await prisma.perfil.findUnique({ where: { id } });
    if (perfil?.sistema)
      return json(
        { error: "Perfis de sistema não podem ser eliminados" },
        400
      );
    await prisma.perfil.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
