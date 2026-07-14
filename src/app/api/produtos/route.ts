import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertAuthenticated, assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";
import { saldosPorProduto } from "@/lib/stock";

export async function GET() {
  try {
    assertAuthenticated(await getSession());
    const [produtos, saldos] = await Promise.all([
      prisma.produto.findMany({ orderBy: { nome: "asc" } }),
      saldosPorProduto(),
    ]);
    return json({
      produtos: produtos.map((p) => ({ ...p, saldo: saldos.get(p.id) ?? 0 })),
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertCan(await getSession(), "stock", "manage");
    const body = await req.json();
    const nome = String(body.nome || "").trim();
    if (!nome) return json({ error: "Nome do produto é obrigatório" }, 400);
    const produto = await prisma.produto.create({
      data: {
        nome,
        unidade: body.unidade ? String(body.unidade).trim() : "un",
        stockMinimo:
          body.stockMinimo === "" || body.stockMinimo == null
            ? null
            : Math.max(0, Math.trunc(Number(body.stockMinimo))),
        descricao: body.descricao ? String(body.descricao).trim() : null,
      },
    });
    return json({ produto }, 201);
  } catch (err) {
    return handleError(err);
  }
}
