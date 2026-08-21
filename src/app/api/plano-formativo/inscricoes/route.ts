import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

function str(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

// Adiciona uma necessidade (inscrição) ao plano.
// Aceita um colaborador existente (colaboradorId) ou um novo (nome + dados);
// e uma formação existente (formacaoId) ou nova (formacaoNome).
export async function POST(req: NextRequest) {
  try {
    assertCan(await getSession(), "plano-formativo", "manage");
    const body = await req.json();

    // --- Plano (ano) ---
    const planoId = str(body.planoId);
    if (!planoId) return json({ error: "Ano/plano é obrigatório" }, 400);
    const plano = await prisma.pfPlano.findUnique({ where: { id: planoId } });
    if (!plano) return json({ error: "Plano não encontrado" }, 404);

    // --- Colaborador ---
    let colaboradorId = str(body.colaboradorId);
    if (!colaboradorId) {
      const nome = str(body.nome);
      if (!nome) return json({ error: "Nome do colaborador é obrigatório" }, 400);
      const existente = await prisma.colaborador.findFirst({ where: { nome } });
      const dados = {
        nome,
        funcao: str(body.funcao),
        direcao: str(body.direcao),
        area: str(body.area),
        liderancaDirecta: str(body.liderancaDirecta),
      };
      const c = existente
        ? await prisma.colaborador.update({ where: { id: existente.id }, data: dados })
        : await prisma.colaborador.create({ data: dados });
      colaboradorId = c.id;
    }

    // --- Formação ---
    let formacaoId = str(body.formacaoId);
    if (!formacaoId) {
      const nome = str(body.formacaoNome);
      if (!nome) return json({ error: "Formação é obrigatória" }, 400);
      const f = await prisma.pfFormacao.upsert({
        where: { nome },
        update: {},
        create: {
          nome,
          competencia: str(body.competencia),
          tipoAccao: str(body.tipoAccao),
          pilar: str(body.pilar),
          entidadeSugerida: str(body.entidade),
        },
      });
      formacaoId = f.id;
    }

    // --- Turma (opcional): aloca logo a inscrição a uma turma. ---
    // Valida que a turma pertence à mesma formação e ao mesmo plano.
    let turmaId = str(body.turmaId);
    if (turmaId) {
      const turma = await prisma.pfTurma.findUnique({
        where: { id: turmaId },
        select: { formacaoId: true, planoId: true },
      });
      if (!turma) return json({ error: "Turma inexistente" }, 404);
      if (turma.formacaoId !== formacaoId)
        return json({ error: "A turma não é da mesma formação" }, 400);
      if (turma.planoId !== planoId)
        return json({ error: "A turma não é do mesmo ano" }, 400);
    }

    // Evita duplicar a mesma necessidade (colaborador + formação) DENTRO do ano.
    const jaExiste = await prisma.pfInscricao.findUnique({
      where: {
        planoId_colaboradorId_formacaoId: { planoId, colaboradorId, formacaoId },
      },
    });
    if (jaExiste) {
      // Se veio uma turma, aloca a inscrição existente em vez de rejeitar.
      if (turmaId) {
        const inscricao = await prisma.pfInscricao.update({
          where: { id: jaExiste.id },
          data: { turmaId },
        });
        return json({ inscricao, alocada: true });
      }
      return json(
        { error: "Este colaborador já está inscrito nesta formação neste ano", inscricao: jaExiste },
        409
      );
    }

    const inscricao = await prisma.pfInscricao.create({
      data: {
        planoId,
        colaboradorId,
        formacaoId,
        prioridade: str(body.prioridade),
        motivo: str(body.motivo),
        turmaId,
      },
    });
    return json({ inscricao }, 201);
  } catch (err) {
    return handleError(err);
  }
}
