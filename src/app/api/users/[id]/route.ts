import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hashPassword } from "@/lib/auth";
import { assertCanManageUsers } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };
const ROLES = ["ADMIN", "MANAGER", "VIEWER"] as const;

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const session = assertCanManageUsers(await getSession());
    const { id } = await params;
    const body = await req.json();

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name).trim();
    if (body.email !== undefined)
      data.email = String(body.email).toLowerCase().trim();
    if (body.username !== undefined) {
      const username = body.username
        ? String(body.username).toLowerCase().trim()
        : null;
      if (username) {
        const uExists = await prisma.user.findFirst({
          where: { OR: [{ username }, { email: username }], NOT: { id } },
        });
        if (uExists)
          return json({ error: "Nome de utilizador já está em uso" }, 409);
      }
      data.username = username;
    }
    if (body.role !== undefined && ROLES.includes(body.role))
      data.role = body.role;
    if (body.perfilId !== undefined)
      data.perfilId = body.perfilId ? String(body.perfilId) : null;
    if (body.notify !== undefined) data.notify = Boolean(body.notify);
    if (body.active !== undefined) data.active = Boolean(body.active);
    if (body.password) {
      if (String(body.password).length < 6)
        return json({ error: "A senha deve ter ao menos 6 caracteres" }, 400);
      data.password = await hashPassword(String(body.password));
    }

    // Evita o admin se rebaixar/desativar e ficar sem acesso.
    if (id === session.sub && (data.role === "VIEWER" || data.active === false)) {
      return json(
        { error: "Você não pode remover o próprio acesso de administrador" },
        400
      );
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        perfilId: true,
        perfil: { select: { id: true, nome: true } },
        notify: true,
        active: true,
        createdAt: true,
      },
    });
    return json({ user });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = assertCanManageUsers(await getSession());
    const { id } = await params;
    if (id === session.sub)
      return json({ error: "Você não pode excluir a si mesmo" }, 400);
    await prisma.user.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
