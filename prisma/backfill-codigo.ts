// Atribui códigos sequenciais (PACT.0001, PACT.0002, ...) aos projectos que
// ainda não têm código. Executar uma vez após adicionar a coluna `codigo`.
// Uso: tsx prisma/backfill-codigo.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const PREFIXO = "PACT.";

async function main() {
  // Maior número já em uso, para continuar a sequência sem colidir.
  const ultimo = await prisma.project.findFirst({
    where: { codigo: { startsWith: PREFIXO } },
    orderBy: { codigo: "desc" },
    select: { codigo: true },
  });
  let n = ultimo?.codigo ? parseInt(ultimo.codigo.slice(PREFIXO.length), 10) : 0;
  if (Number.isNaN(n)) n = 0;

  // Projectos sem código, dos mais antigos para os mais recentes.
  const semCodigo = await prisma.project.findMany({
    where: { codigo: null },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  for (const p of semCodigo) {
    n += 1;
    const codigo = `${PREFIXO}${String(n).padStart(4, "0")}`;
    await prisma.project.update({ where: { id: p.id }, data: { codigo } });
    console.log(`  ${codigo}  ← ${p.id}`);
  }

  console.log(`\nConcluído: ${semCodigo.length} projecto(s) codificado(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
