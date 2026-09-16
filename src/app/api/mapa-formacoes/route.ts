import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

function intOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = parseInt(String(v), 10);
  return Number.isNaN(n) ? null : n;
}
function floatOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
/** "YYYY-MM-DD" → Date (meio-dia UTC, para não escorregar de dia por fuso). */
function dateOrNull(v: unknown): Date | null {
  if (!v) return null;
  const s = String(v).slice(0, 10);
  const d = new Date(`${s}T12:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * GET /api/mapa-formacoes?ano=&mes=&q=
 * Lista as formações do mapa (registo manual). Filtra por ano/mês da data de
 * início e por texto livre (cliente ou acção). Ordena por data de início.
 */
export async function GET(req: NextRequest) {
  try {
    assertCan(await getSession(), "mapa-formacoes", "view");
    const { searchParams } = new URL(req.url);
    const ano = intOrNull(searchParams.get("ano"));
    const mes = intOrNull(searchParams.get("mes"));
    const q = (searchParams.get("q") || "").trim();

    // Filtro por período (mês/ano) com base na data de início.
    let dataInicio: { gte: Date; lt: Date } | undefined;
    if (ano && mes) {
      const ini = new Date(Date.UTC(ano, mes - 1, 1));
      const fim = new Date(Date.UTC(ano, mes, 1));
      dataInicio = { gte: ini, lt: fim };
    } else if (ano) {
      const ini = new Date(Date.UTC(ano, 0, 1));
      const fim = new Date(Date.UTC(ano + 1, 0, 1));
      dataInicio = { gte: ini, lt: fim };
    }

    const formacoes = await prisma.mapaFormacao.findMany({
      where: {
        ...(dataInicio ? { dataInicio } : {}),
        ...(q
          ? {
              OR: [
                { cliente: { contains: q } },
                { accao: { contains: q } },
              ],
            }
          : {}),
      },
      orderBy: [{ dataInicio: "asc" }, { createdAt: "asc" }],
    });

    return json({ formacoes });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/mapa-formacoes
 * Cria uma formação no mapa.
 * Body: { cliente, accao, tipoActividade?, dataInicio?, dataFim?, previstos?,
 *         presentes?, concluiram?, cargaHoraria? }.
 */
export async function POST(req: NextRequest) {
  try {
    assertCan(await getSession(), "mapa-formacoes", "manage");
    const body = await req.json();

    const cliente = String(body.cliente || "").trim();
    const accao = String(body.accao || "").trim();
    if (!cliente) return json({ error: "O cliente é obrigatório" }, 400);
    if (!accao) return json({ error: "A acção é obrigatória" }, 400);

    const formacao = await prisma.mapaFormacao.create({
      data: {
        cliente,
        accao,
        tipoActividade: String(body.tipoActividade || "Formação").trim() || "Formação",
        dataInicio: dateOrNull(body.dataInicio),
        dataFim: dateOrNull(body.dataFim),
        previstos: intOrNull(body.previstos),
        presentes: intOrNull(body.presentes),
        concluiram: intOrNull(body.concluiram),
        cargaHoraria: floatOrNull(body.cargaHoraria),
      },
    });
    return json({ formacao }, 201);
  } catch (err) {
    return handleError(err);
  }
}
