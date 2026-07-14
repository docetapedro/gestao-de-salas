import { NextRequest } from "next/server";
import { authenticate, createSession } from "@/lib/auth";
import { json, handleError } from "@/lib/http";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // Aceita "identifier" (email ou username); mantém compat. com "email".
    const identifier = String(body.identifier ?? body.email ?? "");
    const password = body.password;
    if (!identifier || !password) {
      return json({ error: "Email/utilizador e senha são obrigatórios" }, 400);
    }
    const session = await authenticate(identifier, password);
    if (!session) {
      return json({ error: "Credenciais inválidas" }, 401);
    }
    await createSession(session);
    return json({
      user: {
        id: session.sub,
        name: session.name,
        email: session.email,
        role: session.role,
      },
    });
  } catch (err) {
    return handleError(err);
  }
}
