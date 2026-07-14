// Utilitários partilhados pelas rotas de projectos.
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const CODIGO_PREFIXO = "PACT.";

/** Próximo código sequencial de projecto (ex.: PACT.0001). */
export async function nextProjectCodigo(): Promise<string> {
  const ultimo = await prisma.project.findFirst({
    where: { codigo: { startsWith: CODIGO_PREFIXO } },
    orderBy: { codigo: "desc" },
    select: { codigo: true },
  });
  const n = ultimo?.codigo ? parseInt(ultimo.codigo.slice(CODIGO_PREFIXO.length), 10) : 0;
  const proximo = (Number.isNaN(n) ? 0 : n) + 1;
  return `${CODIGO_PREFIXO}${String(proximo).padStart(4, "0")}`;
}

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
    .filter((p) => p && String(p.origem || "").trim())
    .map((p) => {
      const quantidade = Math.max(1, parseInt(String(p.quantidade), 10) || 1);
      const concluidos = Math.min(
        quantidade,
        Math.max(0, parseInt(String(p.concluidos), 10) || 0)
      );
      return {
        nome: str(p.nome),
        tipo: String(p.tipo).toUpperCase() === "B2B" ? "B2B" : "B2C",
        origem: str(p.origem),
        quantidade,
        concluidos,
        descricao: str(p.descricao),
        telefone: str(p.telefone),
        email: str(p.email),
      };
    });
}

/**
 * Turmas iniciais ao criar o projecto. Aceita uma lista `turmas` explícita;
 * se não houver mas o campo legado `codigoTurma` estiver preenchido, cria
 * automaticamente uma turma inicial com esse código.
 */
export function turmasCreate(body: any) {
  const list: any[] = Array.isArray(body.turmas) ? body.turmas : [];
  const explicit = list
    .filter((t) => t && (str(t.codigo) || str(t.nome)))
    .map((t) => ({
      codigo: str(t.codigo),
      nome: str(t.nome),
      dataInicio: parseDate(t.dataInicio),
      dataFim: parseDate(t.dataFim),
    }));
  if (explicit.length === 0 && str(body.codigoTurma)) {
    return [
      {
        codigo: str(body.codigoTurma),
        nome: null,
        dataInicio: parseDate(body.dataInicio),
        dataFim: parseDate(body.dataFim),
      },
    ];
  }
  return explicit;
}

export const projectInclude = {
  pilar: true,
  local: true,
  cliente: true,
  formadores: { include: { formador: true } },
  participantes: { orderBy: { origem: "asc" } },
  financeiro: { include: { rubrica: true } },
  turmas: {
    orderBy: { createdAt: "asc" },
    include: { financeiro: { include: { rubrica: true } } },
  },
} satisfies Prisma.ProjectInclude;
