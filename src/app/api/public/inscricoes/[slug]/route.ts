import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { json, handleError } from "@/lib/http";

type Params = { params: Promise<{ slug: string }> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * GET /api/public/inscricoes/[slug]
 * Dados públicos do evento (para o formulário). Não expõe os inscritos.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { slug } = await params;
    const evento = await prisma.eventoInscricao.findUnique({
      where: { slug },
      select: {
        tipo: true,
        titulo: true,
        descricao: true,
        local: true,
        dataInicio: true,
        ativo: true,
      },
    });
    if (!evento) return json({ error: "Evento não encontrado" }, 404);
    return json({ evento });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/public/inscricoes/[slug]
 * Inscrição pública (SEM login). Body: { nome, email, telefone }.
 * Email e telefone são únicos POR EVENTO.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { slug } = await params;
    const body = await req.json().catch(() => ({}));

    const nome = String(body.nome || "").trim();
    const email = String(body.email || "").trim().toLowerCase();
    const telefone = String(body.telefone || "").trim();

    if (!nome) return json({ error: "Indique o seu nome." }, 400);
    if (!email) return json({ error: "Indique o seu email." }, 400);
    if (!EMAIL_RE.test(email))
      return json({ error: "O email indicado não é válido." }, 400);
    if (!telefone) return json({ error: "Indique o seu telefone." }, 400);

    const evento = await prisma.eventoInscricao.findUnique({
      where: { slug },
      select: { id: true, ativo: true },
    });
    if (!evento) return json({ error: "Evento não encontrado." }, 404);
    if (!evento.ativo)
      return json({ error: "As inscrições para este evento estão encerradas." }, 403);

    // Mensagem específica por campo (o índice único é a garantia final).
    const [porEmail, porTelefone] = await Promise.all([
      prisma.inscricao.findUnique({
        where: { eventoId_email: { eventoId: evento.id, email } },
        select: { id: true },
      }),
      prisma.inscricao.findUnique({
        where: { eventoId_telefone: { eventoId: evento.id, telefone } },
        select: { id: true },
      }),
    ]);
    if (porEmail)
      return json({ error: "Este email já está inscrito neste evento." }, 409);
    if (porTelefone)
      return json({ error: "Este telefone já está inscrito neste evento." }, 409);

    await prisma.inscricao.create({
      data: { eventoId: evento.id, nome, email, telefone },
    });

    return json({ ok: true }, 201);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      const campos = (err.meta?.target as string[] | undefined) || [];
      const campo = campos.some((c) => c.includes("telefone")) ? "telefone" : "email";
      return json({ error: `Este ${campo} já está inscrito neste evento.` }, 409);
    }
    return handleError(err);
  }
}
