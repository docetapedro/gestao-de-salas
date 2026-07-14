import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertAuthenticated, assertCanManage } from "@/lib/permissions";
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
    const session = assertCanManage(await getSession());
    const body = await req.json();

    const produtoId = String(body.produtoId || "").trim();
    if (!produtoId) return json({ error: "Produto é obrigatório" }, 400);

    const tipo = normTipo(body.tipo);
    const quantidade = Math.trunc(Number(body.quantidade));
    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      return json({ error: "Quantidade deve ser um número maior que zero" }, 400);
    }

    const produto = await prisma.produto.findUnique({ where: { id: produtoId } });
    if (!produto) return json({ error: "Produto não encontrado" }, 404);

    // Numa saída, não permitir stock negativo.
    if (tipo === "SAIDA") {
      const saldo = await saldoProduto(produtoId);
      if (quantidade > saldo) {
        return json(
          {
            error: `Stock insuficiente de "${produto.nome}": disponível ${saldo} ${produto.unidade}, pedido ${quantidade}.`,
          },
          400
        );
      }
    }

    const data = body.data ? new Date(body.data) : new Date();
    if (isNaN(data.getTime())) return json({ error: "Data inválida" }, 400);

    const movimento = await prisma.movimentoStock.create({
      data: {
        produtoId,
        tipo,
        quantidade,
        data,
        fornecedorId:
          tipo === "ENTRADA" && body.fornecedorId
            ? String(body.fornecedorId)
            : null,
        clienteId:
          tipo === "SAIDA" && body.clienteId ? String(body.clienteId) : null,
        observacao: body.observacao ? String(body.observacao).trim() : null,
        createdById: session.sub ?? null,
      },
    });
    return json({ movimento }, 201);
  } catch (err) {
    return handleError(err);
  }
}
