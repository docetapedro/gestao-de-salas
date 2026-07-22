import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

/** Normaliza a lista de membros (array de nomes ou de {nome}). */
function normMembros(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((m) => (typeof m === "string" ? m : (m as { nome?: string })?.nome))
    .map((n) => String(n || "").trim())
    .filter(Boolean);
}

export async function POST(req: NextRequest) {
  try {
    assertCan(await getSession(), "gamificacao", "manage");
    const body = await req.json();
    const eventoId = String(body.eventoId || "").trim();
    const nome = String(body.nome || "").trim();
    if (!eventoId) return json({ error: "Evento é obrigatório" }, 400);
    if (!nome) return json({ error: "Nome da equipa é obrigatório" }, 400);

    // Coloca a nova equipa no fim da ordem.
    const ultima = await prisma.equipa.findFirst({
      where: { eventoId },
      orderBy: { ordem: "desc" },
      select: { ordem: true },
    });
    const membros = normMembros(body.membros);

    const equipa = await prisma.equipa.create({
      data: {
        eventoId,
        nome,
        cor: body.cor ? String(body.cor).trim() : "#2563eb",
        lema: body.lema ? String(body.lema).trim() : null,
        ordem: (ultima?.ordem ?? -1) + 1,
        membros: membros.length
          ? { create: membros.map((n) => ({ nome: n })) }
          : undefined,
      },
      include: { membros: { orderBy: { nome: "asc" } } },
    });
    return json({ equipa }, 201);
  } catch (err) {
    return handleError(err);
  }
}
