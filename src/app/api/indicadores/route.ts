import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function intOrNull(v: string | null): number | null {
  if (v === null || v === "") return null;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? null : n;
}

/**
 * GET /api/indicadores?ano=&mes=
 * Lista os indicadores com valores do período (um card por período que casa
 * com o filtro). Para indicadores compostos, anexa os subitens (`filhos`) com
 * os valores desse mesmo ano/mês. Porta a lógica de `Indicador::all()`.
 */
export async function GET(req: NextRequest) {
  try {
    assertCan(await getSession(), "indicadores", "view");
    const { searchParams } = new URL(req.url);
    const ano = intOrNull(searchParams.get("ano"));
    const mes = intOrNull(searchParams.get("mes"));

    const periodos = await prisma.indicadorPeriodo.findMany({
      where: {
        ...(ano ? { ano } : {}),
        ...(mes ? { mes } : {}),
      },
      include: { indicador: true },
      orderBy: [
        { indicador: { ordem: "asc" } },
        { ano: "desc" },
        { mes: "desc" },
      ],
    });

    const indicadores = [];
    for (const p of periodos) {
      const ind = p.indicador;
      const row = {
        id: ind.id,
        titulo: ind.titulo,
        tipoGrafico: ind.tipoGrafico,
        temFilhos: ind.temFilhos,
        valor: p.valor,
        limite: ind.limite,
        detalhes: ind.detalhes,
        ordem: ind.ordem,
        ano: p.ano,
        mes: p.mes,
        filhos: [] as { nome: string; valor: number; ano: number; mes: number }[],
      };
      if (ind.temFilhos) {
        const itemPeriodos = await prisma.indicadorItemPeriodo.findMany({
          where: { ano: p.ano, mes: p.mes, item: { indicadorId: ind.id } },
          include: { item: true },
          orderBy: { item: { id: "asc" } },
        });
        row.filhos = itemPeriodos.map((ip) => ({
          nome: ip.item.nome,
          valor: ip.valor ?? 0,
          ano: ip.ano,
          mes: ip.mes,
        }));
      }
      indicadores.push(row);
    }

    return json({ indicadores });
  } catch (err) {
    return handleError(err);
  }
}

/**
 * POST /api/indicadores
 * Cria um indicador + o valor do período inicial (+ subitens, se compostos).
 * Body: { titulo, tipoGrafico, valor, limite, detalhes, ano, mes, temFilhos,
 *         filhos?: [{ nome, valor }] }.
 * Porta `Indicador::create()` (corrigindo o bug de ligação subitem↔indicador
 * do PHP: os subitens ficam ligados ao indicador, não ao id do período) e já
 * lança os valores dos subitens no período indicado.
 */
export async function POST(req: NextRequest) {
  try {
    assertCan(await getSession(), "indicadores", "manage");
    const body = await req.json();

    const titulo = String(body.titulo || "").trim();
    if (!titulo) return json({ error: "O título é obrigatório" }, 400);
    const ano = parseInt(String(body.ano), 10);
    const mes = parseInt(String(body.mes), 10);
    if (!ano || !mes) return json({ error: "Ano e mês são obrigatórios" }, 400);

    const temFilhos = Boolean(body.temFilhos);
    const valor = num(body.valor);
    const limite = num(body.limite);
    const tipoGrafico = ["bar", "line", "pie"].includes(body.tipoGrafico)
      ? body.tipoGrafico
      : "bar";
    const detalhes = body.detalhes ? String(body.detalhes).trim() : null;

    const filhos: { nome: string; valor: number }[] = temFilhos
      ? (Array.isArray(body.filhos) ? body.filhos : [])
          .filter((f: any) => f && String(f.nome || "").trim())
          .map((f: any) => ({ nome: String(f.nome).trim(), valor: num(f.valor) }))
      : [];

    const indicador = await prisma.$transaction(async (tx) => {
      const ind = await tx.indicador.create({
        data: {
          titulo,
          tipoGrafico,
          temFilhos,
          valor: temFilhos ? 0 : valor,
          limite,
          detalhes,
        },
      });
      // Valor do período (o base fica 0 quando há subitens).
      await tx.indicadorPeriodo.create({
        data: { indicadorId: ind.id, ano, mes, valor: temFilhos ? 0 : valor },
      });
      // Subitens (+ o respectivo valor já lançado neste período).
      for (const f of filhos) {
        const item = await tx.indicadorItem.create({
          data: { indicadorId: ind.id, nome: f.nome, valor: f.valor },
        });
        await tx.indicadorItemPeriodo.create({
          data: { itemId: item.id, ano, mes, valor: f.valor },
        });
      }
      return ind;
    });

    return json({ indicador }, 201);
  } catch (err) {
    return handleError(err);
  }
}
