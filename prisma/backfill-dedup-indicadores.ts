// Deduplica indicadores de QUALIDADE (modelo Indicador) com o mesmo título.
// Agrupa por título normalizado (trim + espaços internos colapsados). Em cada
// grupo com repetidos mantém um "canónico" e funde nele os períodos e subitens
// dos duplicados, apagando depois os duplicados. No fim normaliza o título de
// todos os indicadores (remove espaços a mais).
//
// Corre ANTES do `prisma db push` que aplica o índice único em Indicador.titulo
// (senão o push falharia enquanto ainda houvesse duplicados).
//
// Idempotente: sem duplicados nem títulos com espaços a mais, não altera nada.
// Uso: tsx prisma/backfill-dedup-indicadores.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const norm = (s: string) => s.trim().replace(/\s+/g, " ");

async function main() {
  // A dedup corre ANTES do `db push`. Numa BD nova a tabela ainda não existe —
  // nesse caso não há nada a fazer (o push cria as tabelas de seguida).
  let todos;
  try {
    todos = await prisma.indicador.findMany({
      include: { _count: { select: { periodos: true, itens: true } } },
      orderBy: { createdAt: "asc" },
    });
  } catch (e: any) {
    if (e?.code === "P2021") {
      console.log("[dedup] tabela Indicador ainda não existe — ignorado (BD nova).");
      return;
    }
    throw e;
  }

  // Agrupa por título normalizado.
  const grupos = new Map<string, typeof todos>();
  for (const ind of todos) {
    const k = norm(ind.titulo);
    const arr = grupos.get(k) ?? [];
    arr.push(ind);
    grupos.set(k, arr);
  }

  let fundidos = 0;
  for (const [chave, grupo] of grupos) {
    if (grupo.length < 2) continue;

    // Canónico: mais períodos → mais subitens → mais antigo.
    const ordenados = [...grupo].sort(
      (a, b) =>
        b._count.periodos - a._count.periodos ||
        b._count.itens - a._count.itens ||
        a.createdAt.getTime() - b.createdAt.getTime()
    );
    const keep = ordenados[0];
    const dups = ordenados.slice(1);
    console.log(
      `[dedup] "${chave}": mantém ${keep.id} (${keep._count.periodos} períodos, ` +
        `${keep._count.itens} subitens); funde ${dups.map((d) => d.id).join(", ")}`
    );

    for (const dup of dups) {
      await prisma.$transaction(async (tx) => {
        // Períodos: move para o canónico quando este ainda não tem esse ano/mês.
        const pers = await tx.indicadorPeriodo.findMany({ where: { indicadorId: dup.id } });
        for (const p of pers) {
          const existe = await tx.indicadorPeriodo.findUnique({
            where: {
              indicadorId_ano_mes: { indicadorId: keep.id, ano: p.ano, mes: p.mes },
            },
            select: { id: true },
          });
          if (existe) {
            console.log(
              `[dedup]   ${p.ano}/${p.mes} já existe no canónico — descartado o do duplicado (valor=${p.valor})`
            );
          } else {
            await tx.indicadorPeriodo.update({
              where: { id: p.id },
              data: { indicadorId: keep.id },
            });
          }
        }
        // Subitens: reatribui ao canónico (mantêm os seus próprios períodos).
        await tx.indicadorItem.updateMany({
          where: { indicadorId: dup.id },
          data: { indicadorId: keep.id },
        });
        // Apaga o duplicado (cascata limpa períodos remanescentes conflituosos).
        await tx.indicador.delete({ where: { id: dup.id } });
      });
      fundidos++;
    }
  }

  // Normaliza o título de todos (remove espaços a mais). Seguro: após a dedup,
  // não há dois indicadores com o mesmo título normalizado.
  const restantes = await prisma.indicador.findMany({ select: { id: true, titulo: true } });
  let renomeados = 0;
  for (const ind of restantes) {
    const n = norm(ind.titulo);
    if (n !== ind.titulo) {
      await prisma.indicador.update({ where: { id: ind.id }, data: { titulo: n } });
      renomeados++;
    }
  }

  console.log(
    `[dedup] concluído: ${fundidos} duplicado(s) fundido(s), ${renomeados} título(s) normalizado(s).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
