// Importa o plano de formação a partir de prisma/data/plano-formativo.json
// (extraído da aba "Todos" da planilha PLANO FORMATIVO.xlsx).
//
// Cria/actualiza Colaboradores, PfFormacao (catálogo) e PfInscricao (necessidades).
// Idempotente: usa upsert por chaves naturais (nome do colaborador, nome da
// formação, par colaborador+formação). Correr várias vezes é seguro.
//
// Uso local (SQLite):  npx tsx prisma/import-plano-formativo.ts
// (garante primeiro:   npm run db:dev:push)
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const prisma = new PrismaClient();

type Row = {
  direcao: string | null;
  area: string | null;
  nome: string;
  funcao: string | null;
  liderancaDirecta: string | null;
  formacao: string;
  competencia: string | null;
  entidade: string | null;
  tipoAccao: string | null;
  prioridade: string | null;
  pilar: string | null;
  motivo: string | null;
};

const clean = (v: string | null | undefined) => {
  const t = (v ?? "").trim();
  return t ? t : null;
};

// Normaliza a competência: a origem por vezes tem a FUNÇÃO (Consultor/Analista…)
// nesta coluna — nesses casos fica null para ser corrigida na app.
function normCompetencia(v: string | null, tipo: string | null): string | null {
  const t = (v ?? "").toLowerCase();
  if (t.startsWith("téc") || t.startsWith("tec")) return "Técnica";
  if (t.startsWith("comp")) return "Comportamental";
  if (t.startsWith("evento") || (tipo ?? "").toLowerCase().startsWith("evento"))
    return "Evento";
  return null;
}

// Normaliza o tipo de acção para o conjunto fechado Treinamento/Certificação/Evento.
function normTipo(v: string | null): string | null {
  const t = (v ?? "").toLowerCase();
  if (t.startsWith("cert")) return "Certificação";
  if (t.startsWith("evento")) return "Evento";
  if (t.startsWith("trein") || t.startsWith("form")) return "Treinamento";
  return null;
}

function normPrioridade(v: string | null): string | null {
  const t = (v ?? "").toLowerCase();
  if (t.startsWith("alta")) return "Alta";
  if (t.startsWith("méd") || t.startsWith("med")) return "Média";
  if (t.startsWith("baixa")) return "Baixa";
  return null;
}

async function main() {
  const file = join(__dirname, "data", "plano-formativo.json");
  const rows: Row[] = JSON.parse(readFileSync(file, "utf-8"));
  console.log(`A importar ${rows.length} linha(s) de ${file}\n`);

  // 1) Colaboradores (dedup por nome). Guarda id por nome.
  const colabByNome = new Map<string, string>();
  for (const r of rows) {
    const nome = clean(r.nome);
    if (!nome || colabByNome.has(nome)) continue;
    const existing = await prisma.colaborador.findFirst({ where: { nome } });
    const data = {
      nome,
      funcao: clean(r.funcao),
      direcao: clean(r.direcao),
      area: clean(r.area),
      liderancaDirecta: clean(r.liderancaDirecta),
    };
    const c = existing
      ? await prisma.colaborador.update({ where: { id: existing.id }, data })
      : await prisma.colaborador.create({ data });
    colabByNome.set(nome, c.id);
  }
  console.log(`Colaboradores: ${colabByNome.size}`);

  // 2) Formações (dedup por nome único; primeiro valor não-nulo por atributo).
  const formacaoByNome = new Map<string, string>();
  for (const r of rows) {
    const nome = clean(r.formacao);
    if (!nome) continue;
    const competencia = normCompetencia(r.competencia, r.tipoAccao);
    const tipoAccao = normTipo(r.tipoAccao);
    const pilar = clean(r.pilar);
    const entidadeSugerida = clean(r.entidade);
    const f = await prisma.pfFormacao.upsert({
      where: { nome },
      // Só preenche atributos ainda vazios (não sobrepõe correcções manuais).
      update: {
        competencia: competencia ?? undefined,
        tipoAccao: tipoAccao ?? undefined,
        pilar: pilar ?? undefined,
        entidadeSugerida: entidadeSugerida ?? undefined,
      },
      create: { nome, competencia, tipoAccao, pilar, entidadeSugerida },
    });
    formacaoByNome.set(nome, f.id);
  }
  console.log(`Formações: ${formacaoByNome.size}`);

  // 3) Inscrições (upsert por par colaborador+formação).
  let inscricoes = 0;
  for (const r of rows) {
    const nome = clean(r.nome);
    const formacao = clean(r.formacao);
    if (!nome || !formacao) continue;
    const colaboradorId = colabByNome.get(nome)!;
    const formacaoId = formacaoByNome.get(formacao)!;
    await prisma.pfInscricao.upsert({
      where: { colaboradorId_formacaoId: { colaboradorId, formacaoId } },
      update: {
        prioridade: normPrioridade(r.prioridade) ?? undefined,
        motivo: clean(r.motivo) ?? undefined,
      },
      create: {
        colaboradorId,
        formacaoId,
        prioridade: normPrioridade(r.prioridade),
        motivo: clean(r.motivo),
      },
    });
    inscricoes += 1;
  }
  console.log(`Inscrições: ${inscricoes}`);
  console.log("\nConcluído ✔");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
