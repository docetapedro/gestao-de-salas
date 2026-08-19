import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";
import { isEstadoInscricao, PRIORIDADES } from "@/lib/plano-formativo";

type Params = { params: Promise<{ id: string }> };

function str(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

// Actualiza uma inscrição: aloca a uma turma (turmaId), muda estado ou prioridade.
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "plano-formativo", "manage");
    const { id } = await params;
    const body = await req.json();

    if (body.estado !== undefined && !isEstadoInscricao(body.estado))
      return json({ error: "Estado inválido" }, 400);
    const prioridade =
      body.prioridade !== undefined ? str(body.prioridade) : undefined;
    if (prioridade && !PRIORIDADES.includes(prioridade as (typeof PRIORIDADES)[number]))
      return json({ error: "Prioridade inválida" }, 400);

    // Se for enviada uma turma, valida que pertence à mesma formação da inscrição.
    let turmaId: string | null | undefined = undefined;
    if (body.turmaId !== undefined) {
      turmaId = str(body.turmaId);
      if (turmaId) {
        const insc = await prisma.pfInscricao.findUnique({
          where: { id },
          select: { formacaoId: true },
        });
        const turma = await prisma.pfTurma.findUnique({
          where: { id: turmaId },
          select: { formacaoId: true },
        });
        if (!insc || !turma) return json({ error: "Inscrição ou turma inexistente" }, 404);
        if (turma.formacaoId !== insc.formacaoId)
          return json({ error: "A turma não é da mesma formação" }, 400);
      }
    }

    const inscricao = await prisma.pfInscricao.update({
      where: { id },
      data: {
        estado: body.estado !== undefined ? body.estado : undefined,
        prioridade,
        motivo: body.motivo !== undefined ? str(body.motivo) : undefined,
        turmaId,
      },
    });
    return json({ inscricao });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "plano-formativo", "manage");
    const { id } = await params;
    await prisma.pfInscricao.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
