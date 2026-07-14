import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCanManage } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Lança/actualiza um valor por rubrica na turma (upsert por turma+rubrica).
 * Body: { rubricaId, previsto, realizado }.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    assertCanManage(await getSession());
    const { id: turmaId } = await params;
    const body = await req.json();
    const rubricaId = String(body.rubricaId || "").trim();
    if (!rubricaId) return json({ error: "Rubrica é obrigatória" }, 400);

    const turma = await prisma.turma.findUnique({
      where: { id: turmaId },
      select: { projectId: true },
    });
    if (!turma) return json({ error: "Turma não encontrada" }, 404);

    const previsto = Math.max(0, num(body.previsto));
    const realizado = Math.max(0, num(body.realizado));

    const item = await prisma.financeiroItem.upsert({
      where: { turmaId_rubricaId: { turmaId, rubricaId } },
      update: { previsto, realizado },
      create: { turmaId, projectId: turma.projectId, rubricaId, previsto, realizado },
      include: { rubrica: true },
    });
    return json({ item }, 201);
  } catch (err) {
    return handleError(err);
  }
}
