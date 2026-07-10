// Utilitários partilhados pelas rotas de projectos.
import { Prisma } from "@prisma/client";

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseNum(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

function str(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** Campos escalares do projecto a partir do corpo do pedido. */
export function projectScalars(body: any): Prisma.ProjectUncheckedCreateInput {
  return {
    nome: String(body.nome || "").trim(),
    descricao: str(body.descricao),
    segmentoMercado: str(body.segmentoMercado),
    codigoTurma: str(body.codigoTurma),
    clienteId: str(body.clienteId),
    pilarId: str(body.pilarId),
    localId: str(body.localId),
    dataInicio: parseDate(body.dataInicio),
    dataFim: parseDate(body.dataFim),
    duracaoHoras: parseNum(body.duracaoHoras),
    modalidade: str(body.modalidade),
    nivel: str(body.nivel),
    formadorInterno:
      body.formadorInterno === undefined ? true : Boolean(body.formadorInterno),
    selecaoFormador: str(body.selecaoFormador),
    nps: parseNum(body.nps),
    taxaConclusao: parseNum(body.taxaConclusao),
    taxaPresenca: parseNum(body.taxaPresenca),
    taxaAprovacao: parseNum(body.taxaAprovacao),
    avalFormador: parseNum(body.avalFormador),
    reclamacoes: parseNum(body.reclamacoes) ?? 0,
    avConteudo: parseNum(body.avConteudo),
    avClareza: parseNum(body.avClareza),
    avMateriais: parseNum(body.avMateriais),
    avOrganizacao: parseNum(body.avOrganizacao),
    avAplicabilidade: parseNum(body.avAplicabilidade),
    comentarios: str(body.comentarios),
    responsavelPedagogica: str(body.responsavelPedagogica),
  };
}

export function formadoresCreate(body: any) {
  const ids: string[] = Array.isArray(body.formadorIds) ? body.formadorIds : [];
  return ids
    .filter((id) => typeof id === "string" && id)
    .map((formadorId) => ({ formadorId }));
}

export function participantesCreate(body: any) {
  const list: any[] = Array.isArray(body.participantes) ? body.participantes : [];
  return list
    .filter((p) => p && String(p.nome || "").trim())
    .map((p) => ({
      nome: String(p.nome).trim(),
      tipo: String(p.tipo).toUpperCase() === "B2B" ? "B2B" : "B2C",
      origem: str(p.origem),
      descricao: str(p.descricao),
      telefone: str(p.telefone),
      email: str(p.email),
      concluido: Boolean(p.concluido),
    }));
}

export function financeiroCreate(body: any) {
  const list: any[] = Array.isArray(body.financeiro) ? body.financeiro : [];
  return list
    .filter((f) => f && f.rubricaId)
    .map((f) => ({
      rubricaId: String(f.rubricaId),
      previsto: parseNum(f.previsto) ?? 0,
      realizado: parseNum(f.realizado) ?? 0,
    }));
}

export const projectInclude = {
  pilar: true,
  local: true,
  cliente: true,
  formadores: { include: { formador: true } },
  participantes: { orderBy: { nome: "asc" } },
  financeiro: { include: { rubrica: true } },
} satisfies Prisma.ProjectInclude;
