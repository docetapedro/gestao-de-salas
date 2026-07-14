import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hashPassword } from "@/lib/auth";
import { assertCanManageUsers } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

const ROLES = ["ADMIN", "MANAGER", "VIEWER"] as const;

export async function GET() {
  try {
    assertCanManageUsers(await getSession());
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        notify: true,
        active: true,
        createdAt: true,
      },
    });
    return json({ users });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertCanManageUsers(await getSession());
    const body = await req.json();

    const name = String(body.name || "").trim();
    const email = String(body.email || "").toLowerCase().trim();
    const username = body.username
      ? String(body.username).toLowerCase().trim()
      : null;
    const password = String(body.password || "");
    const role = ROLES.includes(body.role) ? body.role : "VIEWER";

    if (!name) return json({ error: "Nome é obrigatório" }, 400);
    if (!email) return json({ error: "Email é obrigatório" }, 400);
    if (password.length < 6)
      return json({ error: "A senha deve ter ao menos 6 caracteres" }, 400);

    const exists = await prisma.user.findUnique({ where: { email } });
    if (exists) return json({ error: "Já existe um usuário com este email" }, 409);

    if (username) {
      const uExists = await prisma.user.findFirst({
        where: { OR: [{ username }, { email: username }] },
      });
      if (uExists)
        return json({ error: "Nome de utilizador já está em uso" }, 409);
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        username,
        password: await hashPassword(password),
        role,
        notify: body.notify === undefined ? true : Boolean(body.notify),
        active: body.active === undefined ? true : Boolean(body.active),
      },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        role: true,
        notify: true,
        active: true,
        createdAt: true,
      },
    });
    return json({ user }, 201);
  } catch (err) {
    return handleError(err);
  }
}
