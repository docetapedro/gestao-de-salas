// Migração dos dados do módulo "Indicadores de Qualidade" (antiga app PHP
// kpi-academia / BD MySQL `indicadores_academia`) para as tabelas Prisma.
// Os dados do dump (bd_mariadb.sql) vão inline para o seed ser self-contained
// (corre também contra a BD de produção Neon, que não tem o ficheiro .sql).
//
// Uso: tsx prisma/seed-indicadores.ts
// É seguro: só semeia se a tabela Indicador estiver vazia (não duplica).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// indicadores: id antigo, título, tipo, tem subitens, valor, limite, detalhes, ordem
const INDICADORES: [number, string, string, boolean, number, number, string | null, number][] = [
  [2, "Taxa de Ocupação Salas", "bar", true, 0, 100, null, 7],
  [4, "Nº de Formandos", "bar", true, 0, 100, null, 4],
  [5, "Formações Previstas vs Realizadas", "bar", true, 3, 3, null, 5],
  [8, "% Satisfação média dos formandos", "bar", false, 59, 100, null, 3],
  [10, "Formações prestadas a clientes", "bar", true, 0, 10, null, 6],
  [11, "Propostas e Adjudicações", "bar", true, 0, 10, null, 12],
  [12, "Valor total recebido", "bar", false, 251550, 251550, null, 14],
  [13, "Nº Total de Horas de Formação", "bar", false, 108, 108, null, 1],
  [14, "Horas de formação por colaborador(interno)", "bar", false, 16, 16, null, 2],
  [15, "Projectos em Curso", "bar", false, 2, 2, null, 13],
  [16, "Total de Horas de Formação por Local", "bar", true, 51, 336, null, 0],
  [18, "Nº de Exames de certificações", "bar", false, 10, 10, null, 11],
  [19, "Total de Horas por Aluguer/reserva", "bar", false, 51, 51, null, 8],
  [20, "Total de Horas por Aluguer/reserva não faturáveis", "bar", true, 0, 0, null, 9],
  [22, "Total de Horas por Aluguer/reserva faturáveis", "bar", true, 0, 0, null, 10],
  [24, "Nº Total de Horas Formação Plano Interno ", "bar", false, 16, 1000, null, 0],
  [25, "Nº Total de Horas Formação Plano Interno ", "bar", false, 16, 1000, null, 0],
  [26, "Nº Total Horas Formação Academia Externos", "bar", false, 58, 1000, null, 0],
  [27, "Taxa de conversão de Oportunidades em Vendas", "pie", false, 20, 100, null, 0],
];

// indicador_itens: id antigo, indicador_id antigo, nome, valor, limite
const ITENS: [number, number, string, number, number | null][] = [
  [1, 2, "SkyOne", 55, null],
  [2, 2, "TransBrás", 19, null],
  [5, 4, "Internos", 14, null],
  [6, 4, "Externos", 62, null],
  [7, 10, "Interno", 1, null],
  [8, 10, "Externo", 3, null],
  [9, 11, "Propostas", 5, null],
  [10, 11, "Adjudicações", 0, null],
  [11, 16, "Sky One", 80, null],
  [12, 16, "TransBras", 28, null],
  [14, 20, "SkyOne", 0, 0],
  [15, 20, "TransBrás", 0, 0],
  [16, 22, "SkyOne", 0, 0],
  [17, 22, "TransBrás", 0, 0],
  [18, 5, "Previstas", 7, 0],
  [19, 5, "Realizadas", 0, 0],
];

// indicador_periodos: indicador_id antigo, ano, mes, valor
const PERIODOS: [number, number, number, number][] = [
  [2, 2026, 2, 0], [4, 2026, 2, 0], [5, 2026, 2, 3], [8, 2026, 2, 59],
  [10, 2026, 2, 0], [11, 2026, 2, 0], [12, 2026, 2, 251550], [13, 2026, 2, 108],
  [14, 2026, 2, 16], [15, 2026, 2, 2], [16, 2026, 2, 51], [18, 2026, 2, 10],
  [19, 2026, 3, 51], [18, 2026, 3, 5], [8, 2026, 3, 69.23], [2, 2026, 3, 0],
  [4, 2026, 3, 0], [15, 2026, 3, 2], [5, 2026, 3, 2], [10, 2026, 3, 0],
  [11, 2026, 3, 0], [20, 2026, 3, 0], [22, 2026, 3, 0], [13, 2026, 3, 107],
  [14, 2026, 3, 7], [12, 2026, 3, 876348.3], [12, 2026, 4, 377325], [4, 2026, 4, 0],
  [2, 2026, 4, 0], [5, 2026, 4, 0], [18, 2026, 4, 5], [10, 2026, 4, 0],
  [8, 2026, 4, 40], [20, 2026, 4, 0], [22, 2026, 4, 0], [16, 2026, 4, 0],
  [11, 2026, 4, 0], [15, 2026, 4, 1], [14, 2026, 4, 8], [19, 2026, 4, 164],
  [5, 2026, 7, 0], [8, 2026, 7, 88.33], [18, 2026, 7, 12], [24, 2026, 7, 16],
  [25, 2026, 7, 16], [26, 2026, 7, 58], [27, 2026, 7, 20],
];

// indicador_item_periodos: item_id antigo, ano, mes, valor, limite
const ITEM_PERIODOS: [number, number, number, number, number | null][] = [
  [1, 2026, 2, 55, null], [2, 2026, 2, 19, null], [5, 2026, 2, 14, null],
  [6, 2026, 2, 62, null], [7, 2026, 2, 1, null], [8, 2026, 2, 3, null],
  [9, 2026, 2, 5, null], [10, 2026, 2, 0, null], [11, 2026, 2, 80, null],
  [12, 2026, 2, 28, null], [1, 2026, 3, 72.15, null], [2, 2026, 3, 28, null],
  [5, 2026, 3, 10, null], [6, 2026, 3, 34, null], [7, 2026, 3, 1, null],
  [8, 2026, 3, 1, null], [14, 2026, 3, 14, null], [15, 2026, 3, 0, null],
  [16, 2026, 3, 0, null], [17, 2026, 3, 37, null], [9, 2026, 3, 5, 0],
  [10, 2026, 3, 0, 0], [5, 2026, 4, 22, null], [6, 2026, 4, 27, null],
  [1, 2026, 4, 69.51, null], [2, 2026, 4, 30.49, null], [7, 2026, 4, 0, null],
  [8, 2026, 4, 0, null], [14, 2026, 4, 114, null], [15, 2026, 4, 26, null],
  [16, 2026, 4, 0, null], [17, 2026, 4, 24, null], [11, 2026, 4, 114, null],
  [12, 2026, 4, 50, null], [9, 2026, 4, 13, null], [10, 2026, 4, 2, null],
  [18, 2026, 4, 7, null], [19, 2026, 4, 2, null], [18, 2026, 7, 4, null],
  [19, 2026, 7, 2, null],
];

async function main() {
  const existentes = await prisma.indicador.count();
  if (existentes > 0) {
    console.log(
      `Já existem ${existentes} indicadores — seed ignorado (evita duplicar). ` +
        "Apaga-os manualmente se quiseres reimportar."
    );
    return;
  }

  // id antigo -> id novo (cuid)
  const indMap = new Map<number, string>();
  const itemMap = new Map<number, string>();

  for (const [id, titulo, tipo, temFilhos, valor, limite, detalhes, ordem] of INDICADORES) {
    const ind = await prisma.indicador.create({
      data: {
        titulo,
        tipoGrafico: tipo,
        temFilhos,
        valor,
        limite,
        detalhes: detalhes && detalhes.trim() ? detalhes.trim() : null,
        ordem,
      },
    });
    indMap.set(id, ind.id);
  }

  for (const [id, indId, nome, valor, limite] of ITENS) {
    const indicadorId = indMap.get(indId);
    if (!indicadorId) continue;
    const item = await prisma.indicadorItem.create({
      data: { indicadorId, nome, valor, limite: limite ?? null },
    });
    itemMap.set(id, item.id);
  }

  let nPer = 0;
  for (const [indId, ano, mes, valor] of PERIODOS) {
    const indicadorId = indMap.get(indId);
    if (!indicadorId) continue;
    await prisma.indicadorPeriodo.upsert({
      where: { indicadorId_ano_mes: { indicadorId, ano, mes } },
      update: { valor },
      create: { indicadorId, ano, mes, valor },
    });
    nPer++;
  }

  let nItemPer = 0;
  for (const [itemId, ano, mes, valor, limite] of ITEM_PERIODOS) {
    const id = itemMap.get(itemId);
    if (!id) continue;
    await prisma.indicadorItemPeriodo.create({
      data: { itemId: id, ano, mes, valor, limite: limite ?? null },
    });
    nItemPer++;
  }

  console.log(
    `Seed concluído: ${indMap.size} indicadores, ${itemMap.size} subitens, ` +
      `${nPer} períodos, ${nItemPer} valores de subitens.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
