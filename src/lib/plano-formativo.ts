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
  { value: "AGENDADO", label: "Agendado", badge: "bg-blue-100 text-blue-800" },
  { value: "EM_CURSO", label: "Em curso", badge: "bg-indigo-100 text-indigo-800" },
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

/** Remove acentos e baixa a caixa — para pesquisa por nome que ignora acentos. */
export function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
