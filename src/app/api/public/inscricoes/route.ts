import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { json, handleError } from "@/lib/http";

const TEMA = "Inteligência Artificial no Mundo Corporativo";

// Validação simples de email (suficiente para um formulário público).
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/public/inscricoes
 * Inscrição pública num workshop (SEM login).
 * Body: { nome, email, telefone }
 * Email e telefone são únicos — se já existirem, devolve 409 com mensagem
 * amigável a indicar o campo em conflito.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const nome = String(body.nome || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const telefone = String(body.telefone || "").trim();

    if (!nome) return json({ error: "Indique o seu nome." }, 400);
    if (!email) return json({ error: "Indique o seu email." }, 400);
    if (!EMAIL_RE.test(email))
      return json({ error: "O email indicado não é válido." }, 400);
    if (!telefone) return json({ error: "Indique o seu telefone." }, 400);

    // Pré-verificação para dar mensagem específica por campo (além do índice
    // único, que é a garantia final contra duplicados em condição de corrida).
    const [porEmail, porTelefone] = await Promise.all([
      prisma.workshopInscricao.findUnique({ where: { email }, select: { id: true } }),
      prisma.workshopInscricao.findUnique({ where: { telefone }, select: { id: true } }),
    ]);
    if (porEmail)
      return json({ error: "Este email já está inscrito neste workshop." }, 409);
    if (porTelefone)
      return json({ error: "Este telefone já está inscrito neste workshop." }, 409);

    await prisma.workshopInscricao.create({
      data: { nome, email, telefone, tema: TEMA },
    });

    return json({ ok: true }, 201);
  } catch (err) {
    // Barreira final: o índice único pode disparar se dois pedidos chegarem
    // em simultâneo e passarem ambos a pré-verificação.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const campos = (err.meta?.target as string[] | undefined) || [];
      const campo = campos.includes("telefone") ? "telefone" : "email";
      return json(
        { error: `Este ${campo} já está inscrito neste workshop.` },
        409
      );
    }
    return handleError(err);
  }
}
