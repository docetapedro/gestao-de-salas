import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
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

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "projetos", "manage");
    const { id } = await params;
    const body = await req.json();
    const turma = await prisma.turma.update({
      where: { id },
      data: {
        codigo: body.codigo !== undefined ? str(body.codigo) : undefined,
        nome: body.nome !== undefined ? str(body.nome) : undefined,
        dataInicio:
          body.dataInicio !== undefined ? parseDate(body.dataInicio) : undefined,
        dataFim: body.dataFim !== undefined ? parseDate(body.dataFim) : undefined,
      },
    });
    return json({ turma });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "projetos", "manage");
    const { id } = await params;
    // Cascade: apaga os lançamentos financeiros da turma.
    await prisma.turma.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
