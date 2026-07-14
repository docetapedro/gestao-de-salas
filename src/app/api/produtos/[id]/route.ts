import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "stock", "manage");
    const { id } = await params;
    const body = await req.json();
    const produto = await prisma.produto.update({
      where: { id },
      data: {
        nome: body.nome !== undefined ? String(body.nome).trim() : undefined,
        unidade:
          body.unidade !== undefined
            ? String(body.unidade).trim() || "un"
            : undefined,
        stockMinimo:
          body.stockMinimo !== undefined
            ? body.stockMinimo === "" || body.stockMinimo == null
              ? null
              : Math.max(0, Math.trunc(Number(body.stockMinimo)))
            : undefined,
        descricao:
          body.descricao !== undefined
            ? body.descricao
              ? String(body.descricao).trim()
              : null
            : undefined,
        ativo: body.ativo !== undefined ? Boolean(body.ativo) : undefined,
      },
    });
    return json({ produto });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "stock", "manage");
    const { id } = await params;
    const movimentos = await prisma.movimentoStock.count({
      where: { produtoId: id },
    });
    if (movimentos > 0) {
      return json(
        {
          error:
            "Não é possível excluir: o produto tem movimentos registados. Desactive-o em alternativa.",
        },
        409
      );
    }
    await prisma.produto.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
