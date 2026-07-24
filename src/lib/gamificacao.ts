import { prisma } from "@/lib/prisma";

// Paleta sugerida para novas equipas (cores vivas, boas para projeção).
export const CORES_EQUIPA = [
  "#2563eb", // azul
  "#dc2626", // vermelho
  "#16a34a", // verde
  "#f59e0b", // âmbar
  "#7c3aed", // roxo
  "#db2777", // rosa
  "#0891b2", // ciano
  "#ea580c", // laranja
  "#4d7c0f", // lima
  "#0f766e", // teal
];

export type LinhaRanking = {
  equipaId: string;
  nome: string;
  cor: string;
  lema: string | null;
  total: number;
  // Nº de dinâmicas em que a equipa foi 1ª (desempate/curiosidade).
  vitorias: number;
  // Nº de dinâmicas pontuadas.
  dinamicasPontuadas: number;
  posicao: number;
};

/**
 * Calcula o ranking geral de um evento: por equipa, a soma dos pontos de todas
 * as dinâmicas (cada pontuação multiplicada pelo peso da respectiva dinâmica).
 * O desempate é feito por nº de vitórias (1º lugares) e depois pelo nome.
 */
export async function rankingEvento(eventoId: string): Promise<LinhaRanking[]> {
  const [equipas, dinamicas] = await Promise.all([
    prisma.equipa.findMany({
      where: { eventoId },
      orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
      include: { classificacoes: true },
    }),
    prisma.dinamica.findMany({ where: { eventoId } }),
  ]);

  const pesoDe = new Map(dinamicas.map((d) => [d.id, d.peso ?? 1]));

  // Vencedor de cada dinâmica (por pontos brutos) — para contar vitórias.
  const melhorPorDinamica = new Map<string, number>();
  for (const eq of equipas) {
    for (const c of eq.classificacoes) {
      const atual = melhorPorDinamica.get(c.dinamicaId) ?? -Infinity;
      if (c.pontos > atual) melhorPorDinamica.set(c.dinamicaId, c.pontos);
    }
  }

  const linhas: Omit<LinhaRanking, "posicao">[] = equipas.map((eq) => {
    let total = 0;
    let vitorias = 0;
    let dinamicasPontuadas = 0;
    for (const c of eq.classificacoes) {
      const peso = pesoDe.get(c.dinamicaId) ?? 1;
      total += c.pontos * peso;
      if (c.pontos !== 0) dinamicasPontuadas += 1;
      const melhor = melhorPorDinamica.get(c.dinamicaId);
      if (melhor !== undefined && melhor > 0 && c.pontos === melhor) vitorias += 1;
    }
    return {
      equipaId: eq.id,
      nome: eq.nome,
      cor: eq.cor,
      lema: eq.lema,
      total: Math.round(total * 100) / 100,
      vitorias,
      dinamicasPontuadas,
    };
  });

  linhas.sort(
    (a, b) =>
      b.total - a.total ||
      b.vitorias - a.vitorias ||
      a.nome.localeCompare(b.nome)
  );

  // Posição sequencial (1, 2, 3, …) — sem empates partilhados.
  return linhas.map((l, i) => ({ ...l, posicao: i + 1 }));
}

// ===========================================================================
// Quiz por QR Code
// Cada membro responde ao questionário; a pontuação da submissão é
//   (nº de acertos × valorPorAcerto) + bónus de rapidez.
// O bónus de rapidez só existe se a dinâmica tiver `tempoLimiteSeg` definido e
// é proporcional ao tempo que sobrou e à fracção de respostas certas — assim,
// responder depressa mas errado não dá bónus. Os pontos da equipa na dinâmica
// são a SOMA das submissões dos seus membros.
// ===========================================================================

export type ConfigQuiz = {
  valorPorAcerto: number;
  bonusRapidezMax: number;
  tempoLimiteSeg: number | null;
};

/** Pontos de uma submissão individual. Arredonda a 2 casas. */
export function pontuarSubmissao(
  certas: number,
  totalPerguntas: number,
  tempoMs: number,
  cfg: ConfigQuiz
): number {
  const acertoPts = certas * (cfg.valorPorAcerto || 0);

  let bonus = 0;
  const limiteMs = (cfg.tempoLimiteSeg ?? 0) * 1000;
  if (limiteMs > 0 && cfg.bonusRapidezMax > 0 && totalPerguntas > 0) {
    const restante = Math.max(0, limiteMs - Math.max(0, tempoMs));
    const fraccaoCerta = certas / totalPerguntas;
    bonus = cfg.bonusRapidezMax * (restante / limiteMs) * fraccaoCerta;
  }

  return Math.round((acertoPts + bonus) * 100) / 100;
}

/**
 * Recalcula a Classificacao (equipa+dinâmica) de um quiz como a soma dos pontos
 * das submissões dessa equipa nessa dinâmica, e faz upsert. Deve ser chamado
 * após cada submissão. Devolve o total actual da equipa na dinâmica.
 */
export async function recomputarClassificacaoQuiz(
  dinamicaId: string,
  equipaId: string
): Promise<number> {
  const agg = await prisma.quizSubmissao.aggregate({
    where: { dinamicaId, equipaId },
    _sum: { pontos: true },
  });
  const total = Math.round((agg._sum.pontos ?? 0) * 100) / 100;

  await prisma.classificacao.upsert({
    where: { dinamicaId_equipaId: { dinamicaId, equipaId } },
    create: { dinamicaId, equipaId, pontos: total },
    update: { pontos: total },
  });

  return total;
}
