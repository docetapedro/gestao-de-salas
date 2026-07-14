import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}
function str(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

// Cria uma turma para o projecto.
export async function POST(req: NextRequest, { params }: Params) {
  try {
    assertCanManage(await getSession());
    const { id } = await params;
    const body = await req.json();
    const proj = await prisma.project.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!proj) return json({ error: "Projecto não encontrado" }, 404);
    const turma = await prisma.turma.create({
      data: {
        projectId: id,
        codigo: str(body.codigo),
        nome: str(body.nome),
        dataInicio: parseDate(body.dataInicio),
        dataFim: parseDate(body.dataFim),
      },
    });
    return json({ turma }, 201);
  } catch (err) {
    return handleError(err);
  }
}
