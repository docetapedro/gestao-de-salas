import { NextRequest } from "next/server";
import { authenticate, createSession } from "@/lib/auth";
import { json, handleError } from "@/lib/http";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return json({ error: "Email e senha são obrigatórios" }, 400);
    }
    const session = await authenticate(email, password);
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
