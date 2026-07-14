import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertAuthenticated, assertCanManage } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

export async function GET() {
  try {
    assertAuthenticated(await getSession());
    const fornecedores = await prisma.fornecedor.findMany({
      orderBy: { nome: "asc" },
    });
    return json({ fornecedores });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertCanManage(await getSession());
    const body = await req.json();
    const nome = String(body.nome || "").trim();
    if (!nome) return json({ error: "Nome do fornecedor é obrigatório" }, 400);
    const fornecedor = await prisma.fornecedor.create({
      data: {
        nome,
        telefone: body.telefone ? String(body.telefone).trim() : null,
        email: body.email ? String(body.email).trim() : null,
        descricao: body.descricao ? String(body.descricao).trim() : null,
      },
    });
    return json({ fornecedor }, 201);
  } catch (err) {
    return handleError(err);
  }
}
