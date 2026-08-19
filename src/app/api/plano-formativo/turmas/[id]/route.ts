import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";
import { isEstadoTurma } from "@/lib/plano-formativo";

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

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "plano-formativo", "manage");
    const { id } = await params;
    const body = await req.json();
    if (body.estado !== undefined && !isEstadoTurma(body.estado))
      return json({ error: "Estado inválido" }, 400);

    const turma = await prisma.pfTurma.update({
      where: { id },
      data: {
        codigo: body.codigo !== undefined ? str(body.codigo) : undefined,
        estado: body.estado !== undefined ? body.estado : undefined,
        entidade: body.entidade !== undefined ? str(body.entidade) : undefined,
        formador: body.formador !== undefined ? str(body.formador) : undefined,
        local: body.local !== undefined ? str(body.local) : undefined,
        modalidade: body.modalidade !== undefined ? str(body.modalidade) : undefined,
        dataInicio: body.dataInicio !== undefined ? parseDate(body.dataInicio) : undefined,
        dataFim: body.dataFim !== undefined ? parseDate(body.dataFim) : undefined,
        notas: body.notas !== undefined ? str(body.notas) : undefined,
      },
    });
    return json({ turma });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "plano-formativo", "manage");
    const { id } = await params;
    // As inscrições ligadas voltam a "não alocadas" (turmaId = null, onDelete: SetNull).
    await prisma.pfTurma.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
