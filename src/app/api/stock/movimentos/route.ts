import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertAuthenticated, assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";
import { normTipo, saldoProduto } from "@/lib/stock";

export async function GET() {
  try {
    assertAuthenticated(await getSession());
    // Ordem cronológica para calcular o remanescente (saldo corrido) por produto.
    const movimentos = await prisma.movimentoStock.findMany({
      orderBy: [{ data: "asc" }, { createdAt: "asc" }],
      include: {
        produto: { select: { id: true, nome: true, unidade: true } },
        fornecedor: { select: { id: true, nome: true } },
        cliente: { select: { id: true, nome: true } },
      },
    });

    const corrido = new Map<string, number>();
    const comRemanescente = movimentos.map((m) => {
      const atual = corrido.get(m.produtoId) ?? 0;
      const saldo = atual + (m.tipo === "ENTRADA" ? m.quantidade : -m.quantidade);
      corrido.set(m.produtoId, saldo);
      return { ...m, remanescente: saldo };
    });

    // Apresentação: mais recente primeiro.
    comRemanescente.reverse();
    return json({ movimentos: comRemanescente });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = assertCan(await getSession(), "stock", "manage");
    const body = await req.json();

    const tipo = normTipo(body.tipo);

    const data = body.data ? new Date(body.data) : new Date();
    if (isNaN(data.getTime())) return json({ error: "Data inválida" }, 400);

    // Itens: [{ produtoId, quantidade }]. Compat.: aceita produtoId/quantidade singulares.
    const rawItens: unknown[] = Array.isArray(body.itens)
      ? body.itens
      : body.produtoId
        ? [{ produtoId: body.produtoId, quantidade: body.quantidade }]
        : [];

    const itens = rawItens
      .map((it) => {
        const o = it as { produtoId?: unknown; quantidade?: unknown };
        return {
          produtoId: String(o?.produtoId || "").trim(),
          quantidade: Math.trunc(Number(o?.quantidade)),
        };
      })
      .filter(
        (it) => it.produtoId && Number.isFinite(it.quantidade) && it.quantidade > 0
      );

    if (itens.length === 0) {
      return json(
        { error: "Adiciona pelo menos um produto com quantidade válida" },
        400
      );
    }

    // Soma por produto (valida o stock certo mesmo com linhas repetidas do mesmo produto).
    const porProduto = new Map<string, number>();
    for (const it of itens) {
      porProduto.set(it.produtoId, (porProduto.get(it.produtoId) ?? 0) + it.quantidade);
    }

    const produtos = await prisma.produto.findMany({
      where: { id: { in: [...porProduto.keys()] } },
    });
    const mapa = new Map(produtos.map((p) => [p.id, p]));
    for (const id of porProduto.keys()) {
      if (!mapa.has(id)) return json({ error: "Produto não encontrado" }, 404);
    }

    // Numa saída, não permitir stock negativo (por produto).
    if (tipo === "SAIDA") {
      for (const [id, qtd] of porProduto) {
        const saldo = await saldoProduto(id);
        if (qtd > saldo) {
          const p = mapa.get(id)!;
          return json(
            {
              error: `Stock insuficiente de "${p.nome}": disponível ${saldo} ${p.unidade}, pedido ${qtd}.`,
            },
            400
          );
        }
      }
    }

    const fornecedorId =
      tipo === "ENTRADA" && body.fornecedorId ? String(body.fornecedorId) : null;
    const clienteId =
      tipo === "SAIDA" && body.clienteId ? String(body.clienteId) : null;
    const observacao = body.observacao ? String(body.observacao).trim() : null;

    // Cria todos os movimentos numa transação (um registo por item).
    await prisma.$transaction(
      itens.map((it) =>
        prisma.movimentoStock.create({
          data: {
            produtoId: it.produtoId,
            tipo,
            quantidade: it.quantidade,
            data,
            fornecedorId,
            clienteId,
            observacao,
            createdById: session.sub ?? null,
          },
        })
      )
    );
    return json({ ok: true, criados: itens.length }, 201);
  } catch (err) {
    return handleError(err);
  }
}
