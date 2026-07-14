import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertAuthenticated, assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

function normTipo(v: unknown): string {
  return String(v).toUpperCase() === "RECEITA" ? "RECEITA" : "CUSTO";
}

export async function GET() {
  try {
    assertAuthenticated(await getSession());
    const rubricas = await prisma.rubricaTipo.findMany({
      orderBy: [{ tipo: "asc" }, { ordem: "asc" }, { nome: "asc" }],
    });
    return json({ rubricas });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertCan(await getSession(), "cadastros", "manage");
    const body = await req.json();
    const nome = String(body.nome || "").trim();
    if (!nome) return json({ error: "Nome da rubrica é obrigatório" }, 400);
    const rubrica = await prisma.rubricaTipo.create({
      data: {
        nome,
        tipo: normTipo(body.tipo),
        ordem: body.ordem ? Number(body.ordem) : 0,
      },
    });
    return json({ rubrica }, 201);
  } catch (err) {
    return handleError(err);
  }
}
