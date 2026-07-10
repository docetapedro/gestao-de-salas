// Regras de negócio e cálculo dos indicadores do módulo de Gestão de Projectos.
// Espelha os cálculos da planilha Controlo.xlsx (One Page Report).

export type RubricaTipo = "RECEITA" | "CUSTO";
export type Modalidade = "Presencial" | "Online" | "Híbrido";
export type Nivel = "BASICO" | "INTERMEDIO" | "AVANCADO";
export type FormadorTipo = "INTERNO" | "EXTERNO";
export type ParticipanteTipo = "B2B" | "B2C";

export const MODALIDADES: Modalidade[] = ["Presencial", "Online", "Híbrido"];
export const NIVEIS: { value: Nivel; label: string }[] = [
  { value: "BASICO", label: "Básico" },
  { value: "INTERMEDIO", label: "Intermédio" },
  { value: "AVANCADO", label: "Avançado" },
];
export const NIVEL_LABEL: Record<Nivel, string> = {
  BASICO: "Básico",
  INTERMEDIO: "Intermédio",
  AVANCADO: "Avançado",
};

// Metas fixas dos indicadores de qualidade (conforme a planilha).
export const METAS = {
  nps: { alvo: 70, label: ">= 70", cmp: (v: number) => v >= 70 },
  taxaConclusao: { alvo: 90, label: ">= 90%", cmp: (v: number) => v >= 90 },
  taxaPresenca: { alvo: 85, label: ">= 85%", cmp: (v: number) => v >= 85 },
  taxaAprovacao: { alvo: 80, label: ">= 80%", cmp: (v: number) => v >= 80 },
  avalFormador: { alvo: 4.3, label: ">= 4,3", cmp: (v: number) => v >= 4.3 },
  reclamacoes: { alvo: 0, label: "0", cmp: (v: number) => v <= 0 },
} as const;

type FinanceiroItemLike = {
  previsto: number;
  realizado: number;
  rubrica: { tipo: string };
};

export type ProjectForIndicators = {
  duracaoHoras?: number | null;
  nps?: number | null;
  taxaConclusao?: number | null;
  taxaPresenca?: number | null;
  taxaAprovacao?: number | null;
  avalFormador?: number | null;
  reclamacoes?: number | null;
  participantes: unknown[];
  financeiro: FinanceiroItemLike[];
};

function somaPor(itens: FinanceiroItemLike[], tipo: RubricaTipo) {
  return itens.reduce(
    (acc, it) => {
      if (it.rubrica.tipo === tipo) {
        acc.previsto += it.previsto || 0;
        acc.realizado += it.realizado || 0;
      }
      return acc;
    },
    { previsto: 0, realizado: 0 }
  );
}

export type Financeiro = {
  receita: { previsto: number; realizado: number };
  custo: { previsto: number; realizado: number };
  margem: { previsto: number; realizado: number };
  roiPct: number | null; // ((receita - custo) / custo) * 100 (realizado)
  custoPorFormando: number | null;
  breakEvenFormandos: number | null;
  custoRealizadoPct: number | null; // realizado / previsto do custo
};

/** Calcula todos os indicadores derivados de um projecto. */
export function calcularIndicadores(p: ProjectForIndicators) {
  const inscritos = p.participantes.length;
  const receita = somaPor(p.financeiro, "RECEITA");
  const custo = somaPor(p.financeiro, "CUSTO");

  const margem = {
    previsto: receita.previsto - custo.previsto,
    realizado: receita.realizado - custo.realizado,
  };

  const roiPct =
    custo.realizado > 0
      ? ((receita.realizado - custo.realizado) / custo.realizado) * 100
      : null;

  const custoPorFormando = inscritos > 0 ? custo.realizado / inscritos : null;

  // Break-even: nº de formandos para cobrir o custo, à receita média por formando.
  const receitaPorFormando = inscritos > 0 ? receita.realizado / inscritos : 0;
  const breakEvenFormandos =
    receitaPorFormando > 0 ? Math.ceil(custo.realizado / receitaPorFormando) : null;

  const custoRealizadoPct =
    custo.previsto > 0 ? (custo.realizado / custo.previsto) * 100 : null;

  const financeiro: Financeiro = {
    receita,
    custo,
    margem,
    roiPct,
    custoPorFormando,
    breakEvenFormandos,
    custoRealizadoPct,
  };

  const qualidade = {
    nps: statusMeta(p.nps, METAS.nps.cmp),
    taxaConclusao: statusMeta(p.taxaConclusao, METAS.taxaConclusao.cmp),
    taxaPresenca: statusMeta(p.taxaPresenca, METAS.taxaPresenca.cmp),
    taxaAprovacao: statusMeta(p.taxaAprovacao, METAS.taxaAprovacao.cmp),
    avalFormador: statusMeta(p.avalFormador, METAS.avalFormador.cmp),
    reclamacoes: statusMeta(p.reclamacoes ?? 0, METAS.reclamacoes.cmp),
  };

  return { inscritos, financeiro, qualidade };
}

function statusMeta(
  valor: number | null | undefined,
  cmp: (v: number) => boolean
): { valor: number | null; atingiu: boolean | null } {
  if (valor === null || valor === undefined || Number.isNaN(valor)) {
    return { valor: null, atingiu: null };
  }
  return { valor, atingiu: cmp(valor) };
}

/** Formata um valor em Kwanza angolano (AOA), como na planilha. */
export function formatAOA(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return (
    "AOA " +
    v.toLocaleString("pt-AO", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function formatPct(v: number | null | undefined, casas = 0): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v.toLocaleString("pt-PT", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  })}%`;
}
