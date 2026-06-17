import { SignJWT, jwtVerify } from "jose";

// Módulo compatível com Edge (usado também no middleware).
// Não importa Prisma nem bcrypt.

export type SessionPayload = {
  sub: string; // user id
  name: string;
  email: string;
  role: "ADMIN" | "MANAGER" | "VIEWER";
};

const secret = new TextEncoder().encode(
  process.env.AUTH_SECRET || "insecure-dev-secret-change-me"
);

const ALG = "HS256";
export const SESSION_COOKIE = "salas_session";
const MAX_AGE_SECONDS = 60 * 60 * 8; // 8 horas

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret);
}

export async function verifySession(
  token: string | undefined | null
): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });
    return {
      sub: String(payload.sub),
      name: String(payload.name),
      email: String(payload.email),
      role: payload.role as SessionPayload["role"],
    };
  } catch {
    return null;
  }
}

export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
