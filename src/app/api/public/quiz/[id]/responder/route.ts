import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { json, handleError } from "@/lib/http";
import { pontuarSubmissao, recomputarClassificacaoQuiz } from "@/lib/gamificacao";

type Params = { params: Promise<{ id: string }> };

type RespostaIn = { perguntaId?: unknown; opcaoId?: unknown };

/**
 * Submissão pública de um membro a um quiz.
 * Body: { equipaId, nomeMembro, respostas: [{ perguntaId, opcaoId }], tempoMs }
 * Calcula os acertos contra o gabarito, pontua e faz upsert da submissão
 * (uma por equipa+nome). Recalcula a pontuação da equipa na dinâmica.
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const body = await req.json();

    const equipaId = String(body.equipaId || "").trim();
    const nomeMembro = String(body.nomeMembro || "").trim();
    const tempoMs = Math.max(0, Math.trunc(Number(body.tempoMs)) || 0);
    const respostasIn: RespostaIn[] = Array.isArray(body.respostas)
      ? body.respostas
      : [];

    if (!equipaId) return json({ error: "Escolhe a tua equipa" }, 400);
    if (!nomeMembro) return json({ error: "Escreve o teu nome" }, 400);

    const dinamica = await prisma.dinamica.findUnique({
      where: { id },
      include: {
        perguntas: { include: { opcoes: true } },
      },
    });

    if (!dinamica || dinamica.tipo !== "quiz") {
      return json({ error: "Questionário não encontrado" }, 404);
    }
    if (!dinamica.quizAberto) {
      return json({ error: "Este questionário está fechado" }, 403);
    }

    const equipa = await prisma.equipa.findFirst({
      where: { id: equipaId, eventoId: dinamica.eventoId },
      select: { id: true },
    });
    if (!equipa) return json({ error: "Equipa inválida" }, 400);

    // Evita respostas duplicadas do mesmo membro na mesma equipa.
    const jaRespondeu = await prisma.quizSubmissao.findUnique({
      where: {
        dinamicaId_equipaId_nomeMembro: {
          dinamicaId: id,
          equipaId,
          nomeMembro,
        },
      },
      select: { id: true },
    });
    if (jaRespondeu) {
      return json(
        { error: "Já registámos uma resposta com este nome nesta equipa." },
        409
      );
    }

    // Corrige contra o gabarito.
    const escolhaPorPergunta = new Map<string, string>();
    for (const r of respostasIn) {
      const pid = String(r?.perguntaId || "");
      const oid = String(r?.opcaoId || "");
      if (pid && oid) escolhaPorPergunta.set(pid, oid);
    }

    const totalPerguntas = dinamica.perguntas.length;
    let certas = 0;
    for (const p of dinamica.perguntas) {
      const correta = p.opcoes.find((o) => o.correta);
      const escolhida = escolhaPorPergunta.get(p.id);
      if (correta && escolhida === correta.id) certas += 1;
    }

    const pontos = pontuarSubmissao(certas, totalPerguntas, tempoMs, {
      valorPorAcerto: dinamica.valorPorAcerto,
      bonusRapidezMax: dinamica.bonusRapidezMax,
      tempoLimiteSeg: dinamica.tempoLimiteSeg,
    });

    await prisma.quizSubmissao.create({
      data: {
        dinamicaId: id,
        equipaId,
        nomeMembro,
        tempoMs,
        certas,
        totalPerguntas,
        pontos,
      },
    });

    await recomputarClassificacaoQuiz(id, equipaId);

    return json({ ok: true, certas, totalPerguntas, pontos });
  } catch (err) {
    return handleError(err);
  }
}
