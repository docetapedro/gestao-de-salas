// Constantes e helpers do módulo Plano Formativo.
// Estados/prioridades são texto (compatível com o schema String).

export type EstadoTurma =
  | "PLANEADO"
  | "EM_ORGANIZACAO"
  | "AGENDADO"
  | "EM_CURSO"
  | "CONCLUIDO"
  | "CANCELADO";

// Ordem = fluxo real (necessidade → … → acontecer).
export const ESTADOS_TURMA: {
  value: EstadoTurma;
  label: string;
  // Classes Tailwind para o badge (fundo/texto).
  badge: string;
}[] = [
  { value: "PLANEADO", label: "Planeado", badge: "bg-slate-100 text-slate-700" },
  { value: "EM_ORGANIZACAO", label: "Em organização", badge: "bg-amber-100 text-amber-800" },
  { value: "AGENDADO", label: "Agendado", badge: "bg-yellow-100 text-yellow-800" },
  { value: "EM_CURSO", label: "Em curso", badge: "bg-blue-100 text-blue-800" },
  { value: "CONCLUIDO", label: "Concluído", badge: "bg-green-100 text-green-800" },
  { value: "CANCELADO", label: "Cancelado", badge: "bg-rose-100 text-rose-700" },
];

export const ESTADO_TURMA_LABEL: Record<EstadoTurma, string> = Object.fromEntries(
  ESTADOS_TURMA.map((e) => [e.value, e.label])
) as Record<EstadoTurma, string>;

export const ESTADO_TURMA_BADGE: Record<EstadoTurma, string> = Object.fromEntries(
  ESTADOS_TURMA.map((e) => [e.value, e.badge])
) as Record<EstadoTurma, string>;

export function isEstadoTurma(v: unknown): v is EstadoTurma {
  return typeof v === "string" && ESTADOS_TURMA.some((e) => e.value === v);
}

export type EstadoInscricao = "PLANEADO" | "CONFIRMADO" | "CONCLUIDO" | "DESISTIU";

export const ESTADOS_INSCRICAO: { value: EstadoInscricao; label: string; badge: string }[] = [
  { value: "PLANEADO", label: "Planeado", badge: "bg-slate-100 text-slate-700" },
  { value: "CONFIRMADO", label: "Confirmado", badge: "bg-blue-100 text-blue-800" },
  { value: "CONCLUIDO", label: "Concluído", badge: "bg-green-100 text-green-800" },
  { value: "DESISTIU", label: "Desistiu", badge: "bg-rose-100 text-rose-700" },
];

export function isEstadoInscricao(v: unknown): v is EstadoInscricao {
  return typeof v === "string" && ESTADOS_INSCRICAO.some((e) => e.value === v);
}

export const PRIORIDADES = ["Alta", "Média", "Baixa"] as const;
export const COMPETENCIAS = ["Técnica", "Comportamental", "Evento"] as const;
export const TIPOS_ACCAO = ["Treinamento", "Certificação", "Evento"] as const;
export const MODALIDADES = ["Presencial", "Online", "Híbrido"] as const;
export const TURNOS = ["Manhã", "Tarde"] as const;

export const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
export const MESES_CURTO = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

// Trimestres (meses 0-indexados).
export const TRIMESTRES: { value: number; label: string; meses: number[] }[] = [
  { value: 1, label: "1º Trimestre (Jan–Mar)", meses: [0, 1, 2] },
  { value: 2, label: "2º Trimestre (Abr–Jun)", meses: [3, 4, 5] },
  { value: 3, label: "3º Trimestre (Jul–Set)", meses: [6, 7, 8] },
  { value: 4, label: "4º Trimestre (Out–Dez)", meses: [9, 10, 11] },
];

/** Trimestre (1-4) de um mês 0-indexado. */
export function trimestreDoMes(mes: number): number {
  return Math.floor(mes / 3) + 1;
}

/**
 * Dia do mês (1–7) da 1ª segunda-feira de `mes` (0-indexado) em `ano`.
 * A visão trimestral conta a 1ª semana a partir daqui (e não do dia 1),
 * pelo que os dias antes desta segunda ficam agregados na 1ª semana.
 */
export function primeiraSegunda(ano: number, mes: number): number {
  const dow = new Date(ano, mes, 1).getDay(); // 0=Dom … 6=Sáb
  return 1 + ((8 - dow) % 7); // Seg→0, Dom→1, Sáb→2, …
}

/**
 * Índice da semana (0–3) de um dia dentro do mês, com as semanas a começar
 * na 1ª segunda (`fm` = dia da 1ª segunda). Dias antes de `fm` → semana 0.
 * A última semana (3) absorve tudo a partir da 4ª segunda.
 */
export function semanaDoMes(dia: number, fm: number): number {
  if (dia < fm) return 0;
  return Math.min(3, Math.floor((dia - fm) / 7));
}

/**
 * Rótulos das 4 colunas semanais de um mês, dada a 1ª segunda `fm`.
 * Semanas Segunda→Sábado (o Domingo nunca conta): cada intervalo começa na
 * segunda e termina no sábado (fm+5). A 1ª coluna absorve os dias iniciais
 * (1…fm-1) que ficam antes da 1ª segunda.
 */
export function rotulosSemanas(fm: number): string[] {
  return [
    `${fm}–${fm + 5}`,
    `${fm + 7}–${fm + 12}`,
    `${fm + 14}–${fm + 19}`,
    `${fm + 21}+`,
  ];
}

/**
 * Natureza da formação para a visão trimestral: "Transversal" (comportamental/
 * evento) ou "Tech" (técnica). Serve para os totais por natureza.
 */
export function naturezaFormacao(competencia: string | null): "Transversal" | "Tech" {
  return (competencia ?? "").toLowerCase().startsWith("téc") ? "Tech" : "Transversal";
}

/** Remove acentos e baixa a caixa — para pesquisa por nome que ignora acentos. */
export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
