import { Prisma } from "@prisma/client";
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
 *
 * Concorrência: a soma e a escrita correm numa transacção **Serializable**. Se
 * vários membros da mesma equipa submeterem em simultâneo, o Postgres deteta o
 * conflito de escrita (P2034) e nós repetimos — assim o total nunca fica
 * subcontado por uma leitura obsoleta (lost update). Em SQLite (dev) as escritas
 * já são serializadas, portanto o comportamento é o mesmo.
 */
export async function recomputarClassificacaoQuiz(
  dinamicaId: string,
  equipaId: string
): Promise<number> {
  // Serializable só no Postgres; o SQLite (dev) não suporta níveis de isolamento
  // e já serializa as escritas globalmente.
  const ehPostgres = !(process.env.DATABASE_URL ?? "").startsWith("file:");
  const opcoes = ehPostgres
    ? { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    : undefined;

  const MAX_TENTATIVAS = 5;
  for (let tentativa = 1; ; tentativa++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const agg = await tx.quizSubmissao.aggregate({
          where: { dinamicaId, equipaId },
          _sum: { pontos: true },
        });
        const total = Math.round((agg._sum.pontos ?? 0) * 100) / 100;

        await tx.classificacao.upsert({
          where: { dinamicaId_equipaId: { dinamicaId, equipaId } },
          create: { dinamicaId, equipaId, pontos: total },
          update: { pontos: total },
        });

        return total;
      }, opcoes);
    } catch (err) {
      // P2034 = conflito de escrita / deadlock → repetir a transacção.
      const conflito =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2034";
      if (conflito && tentativa < MAX_TENTATIVAS) continue;
      throw err;
    }
  }
}

// ===========================================================================
// Grito de Guerra (votação)
// Cada equipa vota uma vez noutra equipa; vence a mais votada. SÓ o vencedor
// pontua: pontos = nº de votos recebidos × `valorPorVoto`. Havendo empate no
// número máximo de votos, não há vencedor (ninguém pontua).
// ===========================================================================

export type ApuramentoGrito = {
  // Votos recebidos por equipa (só as que receberam ≥1 voto).
  contagem: { equipaId: string; votos: number }[];
  // Equipa vencedora (única com o máximo de votos) ou null (empate / sem votos).
  vencedorEquipaId: string | null;
  maxVotos: number;
  empate: boolean;
};

/** Apura os votos de um grito: contagem por equipa e vencedor (ou empate). */
export function apurarGrito(
  votos: { votadaEquipaId: string }[]
): ApuramentoGrito {
  const mapa = new Map<string, number>();
  for (const v of votos) {
    mapa.set(v.votadaEquipaId, (mapa.get(v.votadaEquipaId) ?? 0) + 1);
  }
  const contagem = [...mapa.entries()].map(([equipaId, votos]) => ({
    equipaId,
    votos,
  }));

  let maxVotos = 0;
  for (const c of contagem) if (c.votos > maxVotos) maxVotos = c.votos;
  const noTopo = contagem.filter((c) => c.votos === maxVotos && maxVotos > 0);
  const empate = noTopo.length > 1;
  const vencedorEquipaId = maxVotos > 0 && !empate ? noTopo[0].equipaId : null;

  return { contagem, vencedorEquipaId, maxVotos, empate };
}

/**
 * Recalcula a Classificacao de um grito. Como só o vencedor pontua, limpa todas
 * as classificações da dinâmica e, havendo vencedor único, grava-lhe
 * `maxVotos × valorPorVoto`. Deve ser chamado após cada voto (ou remoção).
 * Devolve o apuramento actual.
 */
export async function recomputarClassificacaoGrito(
  dinamicaId: string
): Promise<ApuramentoGrito> {
  const [votos, dinamica] = await Promise.all([
    prisma.gritoVoto.findMany({
      where: { dinamicaId },
      select: { votadaEquipaId: true },
    }),
    prisma.dinamica.findUnique({
      where: { id: dinamicaId },
      select: { valorPorVoto: true },
    }),
  ]);

  const apuramento = apurarGrito(votos);
  const valorPorVoto = dinamica?.valorPorVoto ?? 10;

  // Só o vencedor pontua: apaga todas as classificações da dinâmica e, havendo
  // vencedor único, grava-lhe os pontos (nº de votos × valorPorVoto).
  const opVencedor = apuramento.vencedorEquipaId
    ? [
        prisma.classificacao.create({
          data: {
            dinamicaId,
            equipaId: apuramento.vencedorEquipaId,
            pontos: Math.round(apuramento.maxVotos * valorPorVoto * 100) / 100,
          },
        }),
      ]
    : [];

  await prisma.$transaction([
    prisma.classificacao.deleteMany({ where: { dinamicaId } }),
    ...opVencedor,
  ]);

  return apuramento;
}
