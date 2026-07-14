// Migração do modelo antigo (financeiro ligado directamente ao projecto, sem
// Turma) para o novo modelo: para cada projecto que ainda NÃO tem turmas, cria
// UMA turma (com o código da turma antigo, se existir) e liga os lançamentos
// financeiros existentes (turmaId = null) a essa turma.
//
// Idempotente: só actua em projectos sem turmas — correr várias vezes é seguro.
// Uso: tsx prisma/backfill-turmas.ts   (corre também no build da Vercel)
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Projectos que ainda não têm nenhuma turma (modelo antigo).
  const projetos = await prisma.project.findMany({
    where: { turmas: { none: {} } },
    select: { id: true, codigoTurma: true },
  });

  let turmasCriadas = 0;
  let itensMigrados = 0;
  let erros = 0;

  for (const p of projetos) {
    try {
      // Uma turma por projecto (o utilizador confirmou: 1 turma por projecto).
      const turma = await prisma.turma.create({
        data: { projectId: p.id, codigo: p.codigoTurma ?? null },
      });
      // Liga os lançamentos financeiros existentes do projecto a esta turma.
      const res = await prisma.financeiroItem.updateMany({
        where: { projectId: p.id, turmaId: null },
        data: { turmaId: turma.id },
      });
      turmasCriadas += 1;
      itensMigrados += res.count;
      console.log(
        `  ${p.id}: turma "${turma.codigo ?? "—"}" criada, ${res.count} lançamento(s) migrado(s)`
      );
    } catch (e) {
      // Não aborta o deploy por causa de um projecto problemático (ex.: rubrica
      // duplicada a violar o unique [turmaId, rubricaId]); regista e continua.
      erros += 1;
      console.error(`  ERRO no projecto ${p.id}: ${(e as Error).message}`);
    }
  }

  console.log(
    `\nConcluído: ${turmasCriadas} turma(s) criada(s), ${itensMigrados} lançamento(s) migrado(s)` +
      (erros ? `, ${erros} projecto(s) com erro (ver acima)` : "") +
      "."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
