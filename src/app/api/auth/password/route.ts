import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, hashPassword, verifyPassword } from "@/lib/auth";
import { assertAuthenticated } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

// Qualquer usuário autenticado pode alterar a PRÓPRIA senha.
export async function POST(req: NextRequest) {
  try {
    const session = assertAuthenticated(await getSession());
    const { currentPassword, newPassword } = await req.json();

    if (!currentPassword || !newPassword) {
      return json({ error: "Informe a senha atual e a nova senha" }, 400);
    }
    if (String(newPassword).length < 6) {
      return json({ error: "A nova senha deve ter ao menos 6 caracteres" }, 400);
    }

    const user = await prisma.user.findUnique({ where: { id: session.sub } });
    if (!user) return json({ error: "Usuário não encontrado" }, 404);

    const ok = await verifyPassword(String(currentPassword), user.password);
    if (!ok) return json({ error: "Senha atual incorreta" }, 400);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: await hashPassword(String(newPassword)) },
    });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
