// Migra o local único legado (Project.localId) para a nova relação N:N
// (ProjectLocal). Para cada projecto que ainda tem `localId` preenchido mas
// nenhuma entrada em `locais`, cria a ligação correspondente.
//
// Idempotente: o unique [projectId, localId] + o filtro `locais: none` tornam
// seguro correr várias vezes. Uso: tsx prisma/backfill-projeto-locais.ts
// (corre também no build da Vercel).
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Projectos com local legado definido e ainda sem locais N:N.
  const projetos = await prisma.project.findMany({
    where: { localId: { not: null }, locais: { none: {} } },
    select: { id: true, localId: true },
  });

  let migrados = 0;
  let erros = 0;

  for (const p of projetos) {
    try {
      await prisma.projectLocal.create({
        data: { projectId: p.id, localId: p.localId! },
      });
      migrados += 1;
      console.log(`  ${p.id}: local ${p.localId} migrado para locais[]`);
    } catch (e) {
      // Não aborta o deploy por um projecto problemático (ex.: sala apagada);
      // regista e continua.
      erros += 1;
      console.error(`  ERRO no projecto ${p.id}: ${(e as Error).message}`);
    }
  }

  console.log(
    `\nConcluído: ${migrados} projecto(s) migrado(s)` +
      (erros ? `, ${erros} com erro (ver acima)` : "") +
      "."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
