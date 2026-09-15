// Seed do módulo "Analytics › Indicadores de Performance" (quadro mensal
// pedagógico — ver performance.jpg). Semeia apenas o CATÁLOGO: os 17
// indicadores e os 4 segmentos iniciais. Os VALORES são entrada manual
// (nada é semeado nem calculado).
//
// Uso: tsx prisma/seed-performance.ts
// Idempotente: só semeia o que ainda estiver vazio (não duplica).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Segmentos/colunas iniciais (lista própria, gerível na app).
const SEGMENTOS = ["Sky One", "TransBras", "Externo", "Interno"];

// ordem, título, tipo, usaHoras, usaSegmentos, unidade
type IndDef = [number, string, string, boolean, boolean, string | null];
const INDICADORES: IndDef[] = [
  [1, "Taxa de Ocupação de Salas", "PERCENTAGEM", true, true, "%"],
  [2, "Nº de Formandos", "NUMERO", false, true, null],
  [3, "Formações Previstas vs Realizadas — Geral", "PREVISTO_REALIZADO", false, false, null],
  [4, "% Satisfação média dos formandos", "PERCENTAGEM", false, false, "%"],
  [5, "Formações realizadas — Plano Interno", "PREVISTO_REALIZADO", false, false, null],
  [6, "Formações prestadas a clientes externos", "PREVISTO_REALIZADO", false, false, null],
  [7, "Valor total recebido", "MOEDA", false, false, "Kz"],
  [8, "Nº Total de Horas de Formações Academia/Geral", "HORAS", false, false, "h"],
  [9, "Horas de formações Plano Interno — Calendário", "HORAS", false, true, "h"],
  [10, "Horas de Formações Presenciais", "HORAS", false, false, "h"],
  [11, "Horas de Formação online", "HORAS", false, false, "h"],
  [12, "Projectos em Curso", "NUMERO", false, false, null],
  [13, "Total de Horas por Aluguer/reserva", "HORAS", false, false, "h"],
  [14, "Total de Horas por Aluguer/reserva faturáveis", "HORAS", false, true, "h"],
  [15, "Total de Horas por Formações de Calendário Comercial", "HORAS", false, false, "h"],
  [16, "Total de Horas por Aluguer/reserva não faturáveis", "HORAS", false, true, "h"],
  [17, "Nº de Exames de certificações", "NUMERO", false, false, null],
];

async function main() {
  // Segmentos — só cria os que faltarem (por nome).
  const segExistentes = await prisma.perfSegmento.count();
  if (segExistentes === 0) {
    await prisma.perfSegmento.createMany({
      data: SEGMENTOS.map((nome, i) => ({ nome, ordem: i })),
    });
    console.log(`[seed-performance] ${SEGMENTOS.length} segmentos criados.`);
  } else {
    console.log(`[seed-performance] segmentos já existem (${segExistentes}) — ignorado.`);
  }

  // Indicadores — só semeia se a tabela estiver vazia.
  const indExistentes = await prisma.perfIndicador.count();
  if (indExistentes === 0) {
    for (const [ordem, titulo, tipo, usaHoras, usaSegmentos, unidade] of INDICADORES) {
      await prisma.perfIndicador.create({
        data: { ordem, titulo, tipo, usaHoras, usaSegmentos, unidade },
      });
    }
    console.log(`[seed-performance] ${INDICADORES.length} indicadores criados.`);
  } else {
    console.log(`[seed-performance] indicadores já existem (${indExistentes}) — ignorado.`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
