import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";
import { gravarPerguntas, lerConfigQuiz } from "@/lib/quiz-payload";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "gamificacao", "manage");
    const { id } = await params;
    const body = await req.json();
    let peso: number | undefined;
    if (body.peso !== undefined) {
      const p = Number(body.peso);
      peso = Number.isFinite(p) && p > 0 ? p : 1;
    }

    // Se o body traz configuração de quiz (guardar do editor), aplica-a; caso
    // contrário (ex.: só abrir/fechar), não mexe nestes campos.
    const temConfigQuiz =
      body.valorPorAcerto !== undefined ||
      body.bonusRapidezMax !== undefined ||
      body.tempoLimiteSeg !== undefined;
    const cfg = temConfigQuiz ? lerConfigQuiz(body) : undefined;

    // Ao ABRIR o quiz, arranca a contagem global: fecha automaticamente ao fim
    // de `tempoLimiteSeg` segundos. Ao FECHAR, limpa o instante de fecho.
    let quizFechaEm: Date | null | undefined = undefined;
    if (body.quizAberto !== undefined) {
      if (Boolean(body.quizAberto)) {
        // Tempo-limite efetivo: o que vier no body (guardar config) ou o atual.
        let limite: number | null | undefined = cfg?.tempoLimiteSeg;
        if (limite === undefined) {
          const atual = await prisma.dinamica.findUnique({
            where: { id },
            select: { tempoLimiteSeg: true },
          });
          limite = atual?.tempoLimiteSeg ?? null;
        }
        quizFechaEm =
          limite && limite > 0
            ? new Date(Date.now() + limite * 1000)
            : null;
      } else {
        quizFechaEm = null;
      }
    }

    const dinamica = await prisma.dinamica.update({
      where: { id },
      data: {
        nome: body.nome !== undefined ? String(body.nome).trim() : undefined,
        descricao:
          body.descricao !== undefined
            ? body.descricao
              ? String(body.descricao).trim()
              : null
            : undefined,
        peso,
        ordem:
          body.ordem !== undefined ? Math.trunc(Number(body.ordem)) : undefined,
        tipo:
          body.tipo !== undefined
            ? body.tipo === "quiz"
              ? "quiz"
              : "manual"
            : undefined,
        quizAberto:
          body.quizAberto !== undefined ? Boolean(body.quizAberto) : undefined,
        quizFechaEm,
        ...(cfg ?? {}),
      },
    });

    if (Array.isArray(body.perguntas)) {
      await gravarPerguntas(id, body.perguntas);
    }

    return json({ dinamica });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "gamificacao", "manage");
    const { id } = await params;
    await prisma.dinamica.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
