import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { json, handleError } from "@/lib/http";
import { registarTentativaTesouro } from "@/lib/tesouro-payload";

type Params = { params: Promise<{ id: string }> };

/**
 * Tentativa pública de abrir o baú.
 * Body: { equipaId, combinacao }. Regista a tentativa, valida a chave e apura
 * se esta equipa foi a primeira a acertar (first-wins). Não expõe a chave.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();

    const equipaId = String(body.equipaId || "").trim();
    const combinacao = String(body.combinacao || "");
    if (!equipaId) return json({ error: "Escolhe o teu grupo" }, 400);
    if (!combinacao.trim()) return json({ error: "Insere a combinação" }, 400);

    const dinamica = await prisma.dinamica.findUnique({
      where: { id },
      select: { tipo: true, eventoId: true },
    });
    if (!dinamica || dinamica.tipo !== "tesouro") {
      return json({ error: "Baú não encontrado" }, 404);
    }

    const equipa = await prisma.equipa.findFirst({
      where: { id: equipaId, eventoId: dinamica.eventoId },
      select: { id: true },
    });
    if (!equipa) return json({ error: "Grupo inválido" }, 400);

    const r = await registarTentativaTesouro(id, equipaId, combinacao);

    // Nome do vencedor (para mostrar "já aberto por X").
    let vencedorNome: string | null = null;
    if (r.vencedorEquipaId) {
      const v = await prisma.equipa.findUnique({
        where: { id: r.vencedorEquipaId },
        select: { nome: true },
      });
      vencedorNome = v?.nome ?? null;
    }

    return json({ ...r, vencedorNome });
  } catch (err) {
    return handleError(err);
  }
}
