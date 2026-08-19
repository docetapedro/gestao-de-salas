import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";
import { isEstadoTurma } from "@/lib/plano-formativo";

const str = (v: unknown) => {
  const t = typeof v === "string" ? v.trim() : "";
  return t ? t : null;
};
const date = (v: unknown) => (v ? new Date(v as string) : null);
const num = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Cria uma turma/edição para uma formação.
export async function POST(req: NextRequest) {
  try {
    assertCan(await getSession(), "plano-formativo", "manage");
    const body = await req.json();
    const formacaoId = str(body.formacaoId);
    const planoId = str(body.planoId);
    if (!formacaoId) return json({ error: "Formação é obrigatória" }, 400);
    if (!planoId) return json({ error: "Ano/plano é obrigatório" }, 400);

    const [formacao, plano] = await Promise.all([
      prisma.pfFormacao.findUnique({ where: { id: formacaoId } }),
      prisma.pfPlano.findUnique({ where: { id: planoId } }),
    ]);
    if (!formacao) return json({ error: "Formação não encontrada" }, 404);
    if (!plano) return json({ error: "Plano não encontrado" }, 404);

    const estado = isEstadoTurma(body.estado) ? body.estado : "PLANEADO";
    const turma = await prisma.pfTurma.create({
      data: {
        planoId,
        formacaoId,
        codigo: str(body.codigo),
        estado,
        entidade: str(body.entidade) ?? formacao.entidadeSugerida,
        formador: str(body.formador),
        local: str(body.local),
        modalidade: str(body.modalidade),
        duracaoHoras: num(body.duracaoHoras),
        turno: str(body.turno),
        dataInicio: date(body.dataInicio),
        dataFim: date(body.dataFim),
        notas: str(body.notas),
      },
    });
    return json({ turma }, 201);
  } catch (err) {
    return handleError(err);
  }
}
