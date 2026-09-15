import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

const TIPOS = ["PERCENTAGEM", "NUMERO", "HORAS", "MOEDA", "PREVISTO_REALIZADO"];

/**
 * GET /api/performance/indicadores
 * Lista todos os indicadores (inclui inativos, para gestão).
 */
export async function GET() {
  try {
    assertCan(await getSession(), "performance", "view");
    const indicadores = await prisma.perfIndicador.findMany({
      orderBy: [{ ordem: "asc" }, { titulo: "asc" }],
    });
    return json({ indicadores });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/performance/indicadores
 * Cria um indicador do catálogo.
 * Body: { titulo, tipo, usaHoras?, usaSegmentos?, unidade?, ordem? }.
 */
export async function POST(req: NextRequest) {
  try {
    assertCan(await getSession(), "performance", "manage");
    const body = await req.json();
    const titulo = String(body.titulo || "").trim();
    if (!titulo) return json({ error: "O título é obrigatório" }, 400);
    const tipo = TIPOS.includes(body.tipo) ? body.tipo : "NUMERO";

    const max = await prisma.perfIndicador.aggregate({ _max: { ordem: true } });
    const ordem =
      body.ordem !== undefined ? Number(body.ordem) : (max._max.ordem ?? 0) + 1;

    const indicador = await prisma.perfIndicador.create({
      data: {
        titulo,
        tipo,
        usaHoras: Boolean(body.usaHoras),
        usaSegmentos: body.usaSegmentos === undefined ? true : Boolean(body.usaSegmentos),
        unidade: body.unidade ? String(body.unidade).trim() || null : null,
        ordem,
      },
    });
    return json({ indicador }, 201);
  } catch (err) {
    return handleError(err);
  }
}
