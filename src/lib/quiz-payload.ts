import { prisma } from "@/lib/prisma";

// Utilitários partilhados pelas rotas admin do quiz: ler a configuração de
// pontuação a partir do body e gravar (replace-all) as perguntas/opções.

/** Extrai a configuração de quiz do body, com defaults e limites sãos. */
export function lerConfigQuiz(body: Record<string, unknown>) {
  const valor = Number(body.valorPorAcerto);
  const bonus = Number(body.bonusRapidezMax);
  const limiteRaw = body.tempoLimiteSeg;

  let tempoLimiteSeg: number | null = null;
  if (limiteRaw !== undefined && limiteRaw !== null && limiteRaw !== "") {
    const n = Math.trunc(Number(limiteRaw));
    tempoLimiteSeg = Number.isFinite(n) && n > 0 ? n : null;
  }

  return {
    valorPorAcerto: Number.isFinite(valor) && valor >= 0 ? valor : 10,
    bonusRapidezMax: Number.isFinite(bonus) && bonus >= 0 ? bonus : 20,
    tempoLimiteSeg,
  };
}

type PerguntaIn = {
  enunciado?: unknown;
  opcoes?: unknown;
};
type OpcaoIn = {
  texto?: unknown;
  correta?: unknown;
};

/**
 * Substitui todas as perguntas/opções de uma dinâmica pelas do payload.
 * Ignora perguntas sem enunciado ou sem pelo menos uma opção com texto.
 * A ordem segue a ordem do array recebido.
 */
export async function gravarPerguntas(
  dinamicaId: string,
  perguntas: unknown
): Promise<void> {
  const lista = Array.isArray(perguntas) ? (perguntas as PerguntaIn[]) : [];

  // Transação em LOTE (array) em vez de interativa (callback): é segura com
  // ligações "pooled" (ex.: Neon/PgBouncer em produção), onde a forma
  // interativa pode falhar e deixar a dinâmica sem perguntas.
  const ops: unknown[] = [
    prisma.quizPergunta.deleteMany({ where: { dinamicaId } }),
  ];

  let ordemP = 0;
  for (const p of lista) {
    const enunciado = String(p?.enunciado ?? "").trim();
    const opcoesIn = Array.isArray(p?.opcoes) ? (p.opcoes as OpcaoIn[]) : [];
    const opcoes = opcoesIn
      .map((o, i) => ({
        texto: String(o?.texto ?? "").trim(),
        correta: Boolean(o?.correta),
        ordem: i,
      }))
      .filter((o) => o.texto.length > 0);

    if (!enunciado || opcoes.length === 0) continue;

    ops.push(
      prisma.quizPergunta.create({
        data: {
          dinamicaId,
          enunciado,
          ordem: ordemP++,
          opcoes: { create: opcoes },
        },
      })
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await prisma.$transaction(ops as any);
}
