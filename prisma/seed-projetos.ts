// Seed do módulo de Gestão de Projectos: rubricas e pilares padrão.
// Uso: tsx prisma/seed-projetos.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const RUBRICAS: { nome: string; tipo: "RECEITA" | "CUSTO"; ordem: number }[] = [
  { nome: "Receita (Total do Projecto)", tipo: "RECEITA", ordem: 0 },
  { nome: "Custo com licença Ipersonality", tipo: "CUSTO", ordem: 1 },
  { nome: "Custo com horas de serviços Academia", tipo: "CUSTO", ordem: 2 },
  { nome: "Custos não previstos", tipo: "CUSTO", ordem: 3 },
  { nome: "Outros custos", tipo: "CUSTO", ordem: 4 },
  { nome: "Valor do IVA 14%", tipo: "CUSTO", ordem: 5 },
];

const PILARES = [
  "Diagnóstico e Desenvolvimento de CH",
  "Cultura Organizacional",
  "Liderança & Gestão",
  "Competências Técnicas",
];

async function main() {
  for (const r of RUBRICAS) {
    await prisma.rubricaTipo.upsert({
      where: { nome_tipo: { nome: r.nome, tipo: r.tipo } },
      update: { ordem: r.ordem },
      create: r,
    });
  }
  for (const nome of PILARES) {
    await prisma.pilar.upsert({ where: { nome }, update: {}, create: { nome } });
  }
  console.log("Seed de projectos concluído (rubricas e pilares).");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
