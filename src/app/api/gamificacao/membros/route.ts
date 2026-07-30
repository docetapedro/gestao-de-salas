import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

/** Extrai nomes de um array (de strings ou {nome}) ou de um texto multi-linha. */
function normNomes(v: unknown): string[] {
  let bruto: unknown[] = [];
  if (Array.isArray(v)) {
    bruto = v;
  } else if (typeof v === "string") {
    bruto = v.split(/[\n,;]+/);
  }
  const nomes = bruto
    .map((m) => (typeof m === "string" ? m : (m as { nome?: string })?.nome))
    .map((n) => String(n || "").trim())
    .filter(Boolean);
  // Remove duplicados (mesmo nome), preservando a ordem.
  return [...new Set(nomes)];
}

/**
 * Pré-cadastro de participantes de um evento.
 * Body: { eventoId, nomes: string[] | string, equipaId?: string|null }
 * Cria os membros (por omissão sem equipa) para depois serem associados.
 */
export async function POST(req: NextRequest) {
  try {
    assertCan(await getSession(), "gamificacao", "manage");
    const body = await req.json();
    const eventoId = String(body.eventoId || "").trim();
    if (!eventoId) return json({ error: "Evento é obrigatório" }, 400);

    const nomes = normNomes(body.nomes ?? body.nome);
    if (nomes.length === 0) return json({ error: "Indica pelo menos um nome" }, 400);

    const equipaId =
      body.equipaId === undefined || body.equipaId === null
        ? null
        : String(body.equipaId).trim() || null;

    // Se vier equipaId, valida que a equipa pertence ao evento.
    if (equipaId) {
      const eq = await prisma.equipa.findFirst({
        where: { id: equipaId, eventoId },
        select: { id: true },
      });
      if (!eq) return json({ error: "Equipa inválida" }, 400);
    }

    await prisma.equipaMembro.createMany({
      data: nomes.map((nome) => ({ eventoId, equipaId, nome })),
    });

    const membros = await prisma.equipaMembro.findMany({
      where: { eventoId },
      orderBy: { nome: "asc" },
    });
    return json({ membros }, 201);
  } catch (err) {
    return handleError(err);
  }
}

/**
 * Elimina participantes em lote.
 * Body: { eventoId, ids: string[] } — só apaga membros que pertençam ao evento
 * indicado (segurança). Idempotente: ids já inexistentes são ignorados.
 */
export async function DELETE(req: NextRequest) {
  try {
    assertCan(await getSession(), "gamificacao", "manage");
    const body = await req.json();
    const eventoId = String(body.eventoId || "").trim();
    if (!eventoId) return json({ error: "Evento é obrigatório" }, 400);

    const ids = (Array.isArray(body.ids) ? body.ids : [])
      .map((v: unknown) => String(v || "").trim())
      .filter(Boolean);
    if (ids.length === 0) return json({ error: "Nenhum participante indicado" }, 400);

    // Membros de um evento estão ou na pool (eventoId) ou numa equipa do evento
    // (equipa.eventoId). Cobrimos ambos os casos no filtro.
    const res = await prisma.equipaMembro.deleteMany({
      where: {
        id: { in: ids },
        OR: [{ eventoId }, { equipa: { eventoId } }],
      },
    });
    return json({ ok: true, apagados: res.count });
  } catch (err) {
    return handleError(err);
  }
}
