import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertAuthenticated, assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

export async function GET() {
  try {
    assertAuthenticated(await getSession());
    const pilares = await prisma.pilar.findMany({ orderBy: { nome: "asc" } });
    return json({ pilares });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertCan(await getSession(), "cadastros", "manage");
    const body = await req.json();
    const nome = String(body.nome || "").trim();
    if (!nome) return json({ error: "Nome do pilar é obrigatório" }, 400);
    const pilar = await prisma.pilar.create({ data: { nome } });
    return json({ pilar }, 201);
  } catch (err) {
    return handleError(err);
  }
}
