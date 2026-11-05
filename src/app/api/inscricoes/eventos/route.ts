import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";
import { gerarSlug } from "@/lib/inscricoes";

/** "YYYY-MM-DDTHH:mm" (datetime-local) → Date, ou null. */
function dateTimeOrNull(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * GET /api/inscricoes/eventos
 * Lista os eventos de inscrição com a contagem de inscritos. Mais recentes
 * primeiro.
 */
export async function GET() {
  try {
    assertCan(await getSession(), "inscricoes", "view");
    const eventos = await prisma.eventoInscricao.findMany({
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { inscricoes: true } } },
    });
    return json({ eventos });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/inscricoes/eventos
 * Cria um evento e gera um slug único para o link público.
 * Body: { tipo?, titulo, descricao?, local?, dataInicio? }
 */
export async function POST(req: NextRequest) {
  try {
    assertCan(await getSession(), "inscricoes", "manage");
    const body = await req.json();

    const titulo = String(body.titulo || "").trim();
    if (!titulo) return json({ error: "O nome do evento é obrigatório." }, 400);

    const tipo = String(body.tipo || "Workshop").trim() || "Workshop";
    const descricao = String(body.descricao || "").trim() || null;
    const local = String(body.local || "").trim() || null;
    const dataInicio = dateTimeOrNull(body.dataInicio);

    // Garante slug único (tenta algumas vezes em caso de colisão improvável).
    let slug = gerarSlug(titulo);
    for (let i = 0; i < 5; i++) {
      const existe = await prisma.eventoInscricao.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!existe) break;
      slug = gerarSlug(titulo);
    }

    const evento = await prisma.eventoInscricao.create({
      data: { tipo, titulo, descricao, local, dataInicio, slug },
    });
    return json({ evento }, 201);
  } catch (err) {
    return handleError(err);
  }
}
