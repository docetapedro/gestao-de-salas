// Corrige a pontuação do vencedor das dinâmicas "Grito de Guerra": deve ser o
// valor fixo `valorPorVoto` (NÃO multiplicado pelo nº de votos). Bugs antigos
// gravaram `nº votos × valorPorVoto`; este backfill repõe o valor correcto.
// Idempotente: só toca em linhas com valor diferente; correr várias vezes é seguro.
// Uso: tsx prisma/backfill-grito-pontos.ts  (corre também no build da Vercel)
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const gritos = await prisma.dinamica.findMany({
    where: { tipo: "grito" },
    select: { id: true, nome: true, valorPorVoto: true },
  });

  let total = 0;
  for (const d of gritos) {
    const res = await prisma.classificacao.updateMany({
      where: { dinamicaId: d.id, pontos: { not: d.valorPorVoto } },
      data: { pontos: d.valorPorVoto },
    });
    if (res.count) {
      total += res.count;
      console.log(
        `  "${d.nome}": ${res.count} classificação(ões) corrigida(s) → ${d.valorPorVoto}`
      );
    }
  }

  console.log(
    `Concluído: ${total} classificação(ões) de grito corrigida(s) (valor fixo do vencedor).`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
