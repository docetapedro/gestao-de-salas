import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

function str(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

// Edita atributos da formação (ex.: corrigir competência/pilar importados).
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "plano-formativo", "manage");
    const { id } = await params;
    const body = await req.json();
    const formacao = await prisma.pfFormacao.update({
      where: { id },
      data: {
        nome: body.nome !== undefined ? str(body.nome) ?? undefined : undefined,
        competencia: body.competencia !== undefined ? str(body.competencia) : undefined,
        tipoAccao: body.tipoAccao !== undefined ? str(body.tipoAccao) : undefined,
        pilar: body.pilar !== undefined ? str(body.pilar) : undefined,
        area: body.area !== undefined ? str(body.area) : undefined,
        entidadeSugerida:
          body.entidadeSugerida !== undefined ? str(body.entidadeSugerida) : undefined,
        descricao: body.descricao !== undefined ? str(body.descricao) : undefined,
      },
    });
    return json({ formacao });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "plano-formativo", "manage");
    const { id } = await params;
    // Cascade: apaga turmas e inscrições desta formação.
    await prisma.pfFormacao.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
