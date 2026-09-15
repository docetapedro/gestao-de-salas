import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

/**
 * GET /api/performance/segmentos
 * Lista todos os segmentos/colunas (inclui inativos, para gestão).
 */
export async function GET() {
  try {
    assertCan(await getSession(), "performance", "view");
    const segmentos = await prisma.perfSegmento.findMany({
      orderBy: [{ ordem: "asc" }, { nome: "asc" }],
    });
    return json({ segmentos });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/performance/segmentos
 * Cria um segmento. Body: { nome, ordem? }.
 */
export async function POST(req: NextRequest) {
  try {
    assertCan(await getSession(), "performance", "manage");
    const body = await req.json();
    const nome = String(body.nome || "").trim();
    if (!nome) return json({ error: "O nome é obrigatório" }, 400);

    const max = await prisma.perfSegmento.aggregate({ _max: { ordem: true } });
    const ordem =
      body.ordem !== undefined ? Number(body.ordem) : (max._max.ordem ?? -1) + 1;

    const segmento = await prisma.perfSegmento.create({ data: { nome, ordem } });
    return json({ segmento }, 201);
  } catch (err) {
    return handleError(err);
  }
}
