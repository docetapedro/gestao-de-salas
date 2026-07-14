import "server-only";
import { cookies, headers } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  signSession,
  verifySession,
  type SessionPayload,
} from "./jwt";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(
  plain: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Lê a sessão atual a partir do cookie (ou null). */
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return verifySession(token);
}

/** Cria o cookie de sessão para o usuário informado. */
export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  const store = await cookies();
  // Só marca o cookie como "secure" quando a ligação é realmente HTTPS.
  // Assim funciona em produção na Vercel (HTTPS) e também em testes na rede
  // local por HTTP (onde o browser recusaria um cookie secure).
  const proto = (await headers()).get("x-forwarded-proto");
  const secure = proto === "https";
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/**
 * Autentica por email OU nome de utilizador (+ senha).
 * Retorna o payload da sessão ou null.
 */
export async function authenticate(
  identifier: string,
  password: string
): Promise<SessionPayload | null> {
  const id = identifier.toLowerCase().trim();
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: id }, { username: id }] },
  });
  if (!user || !user.active) return null;
  const ok = await verifyPassword(password, user.password);
  if (!ok) return null;
  return {
    sub: user.id,
    name: user.name,
    email: user.email,
    role: user.role as SessionPayload["role"],
  };
}
