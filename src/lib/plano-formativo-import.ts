// Lê um ficheiro .xlsx (o template preenchido, ou o export "Todos") e devolve
// as linhas de inscrição normalizadas, prontas para importar. Usado pelo
// endpoint de importação pela UI.
import ExcelJS from "exceljs";
import { normalizar } from "./plano-formativo";

export type ImportRow = {
  direcao: string | null;
  area: string | null;
  nome: string | null;
  funcao: string | null;
  liderancaDirecta: string | null;
  formacao: string | null;
  competencia: string | null;
  entidade: string | null;
  tipoAccao: string | null;
  prioridade: string | null;
  pilar: string | null;
  motivo: string | null;
};

type Campo = keyof ImportRow;

/** Extrai texto de uma célula (string, número, rich text, fórmula, hiperligação). */
function cellText(v: ExcelJS.CellValue): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return String(v);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as unknown as Record<string, unknown>;
    if (Array.isArray(o.richText))
      return (o.richText as { text?: string }[]).map((r) => r.text ?? "").join("").trim() || null;
    if (typeof o.text === "string") return o.text.trim() || null;
    if (o.result !== undefined && o.result !== null) return String(o.result).trim() || null;
  }
  return String(v).trim() || null;
}

/** Faz corresponder um cabeçalho a um campo (tolerante a acentos/variações). */
function detectarCampo(header: string): Campo | null {
  const h = normalizar(header).replace(/\?/g, "").trim();
  if (!h) return null;
  if (h.includes("direc")) return "direcao";
  if (h.includes("nome")) return "nome";
  if (h.includes("funca") || h.includes("funcao")) return "funcao";
  if (h.includes("lideranca")) return "liderancaDirecta";
  if (h.includes("designacao") || h.includes("formacao")) return "formacao";
  if (h.includes("competencia")) return "competencia";
  if (h.includes("entidade")) return "entidade";
  if (h.includes("tipo")) return "tipoAccao";
  if (h.includes("prioridade")) return "prioridade";
  if (h.includes("pilar")) return "pilar";
  if (h.includes("por que") || h.includes("porque") || h.includes("motivo")) return "motivo";
  if (h === "area" || h.startsWith("area")) return "area";
  return null;
}

/* --------------------------- Normalizações -------------------------------- */
export function normCompetencia(v: string | null, tipo: string | null): string | null {
  const t = (v ?? "").toLowerCase();
  if (t.startsWith("téc") || t.startsWith("tec")) return "Técnica";
  if (t.startsWith("comp")) return "Comportamental";
  if (t.startsWith("evento") || (tipo ?? "").toLowerCase().startsWith("evento")) return "Evento";
  return null;
}
export function normTipo(v: string | null): string | null {
  const t = (v ?? "").toLowerCase();
  if (t.startsWith("cert")) return "Certificação";
  if (t.startsWith("evento")) return "Evento";
  if (t.startsWith("trein") || t.startsWith("form")) return "Treinamento";
  return null;
}
export function normPrioridade(v: string | null): string | null {
  const t = (v ?? "").toLowerCase();
  if (t.startsWith("alta")) return "Alta";
  if (t.startsWith("méd") || t.startsWith("med")) return "Média";
  if (t.startsWith("baixa")) return "Baixa";
  return null;
}

/**
 * Lê o buffer .xlsx e devolve as linhas válidas (com nome e formação).
 * Escolhe a folha "Inscrições" ou "Todos"; senão a primeira. Mapeia por
 * cabeçalho (linha 1). Ignora a linha de exemplo do template e linhas vazias.
 */
export async function parseTemplateBuffer(buffer: Buffer): Promise<ImportRow[]> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as Parameters<typeof wb.xlsx.load>[0]);

  const ws =
    wb.getWorksheet("Inscrições") ??
    wb.getWorksheet("Todos") ??
    wb.worksheets[0];
  if (!ws) throw new Error("O ficheiro não tem nenhuma folha de dados.");

  // Cabeçalhos (linha 1) → índice de coluna por campo.
  const colDe = new Map<Campo, number>();
  const headerRow = ws.getRow(1);
  headerRow.eachCell((cell, col) => {
    const campo = detectarCampo(cellText(cell.value) ?? "");
    if (campo && !colDe.has(campo)) colDe.set(campo, col);
  });
  if (!colDe.has("nome") || !colDe.has("formacao"))
    throw new Error(
      'Não encontrei as colunas obrigatórias ("Nome do colaborador" e "Designação da formação"). Use o template.'
    );

  const val = (row: ExcelJS.Row, campo: Campo): string | null => {
    const c = colDe.get(campo);
    return c ? cellText(row.getCell(c).value) : null;
  };

  const rows: ImportRow[] = [];
  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    const nome = val(row, "nome");
    const formacao = val(row, "formacao");
    if (!nome || !formacao) continue; // vazia/incompleta
    if (normalizar(nome).includes("exemplo")) continue; // linha de exemplo do template
    rows.push({
      direcao: val(row, "direcao"),
      area: val(row, "area"),
      nome,
      funcao: val(row, "funcao"),
      liderancaDirecta: val(row, "liderancaDirecta"),
      formacao,
      competencia: val(row, "competencia"),
      entidade: val(row, "entidade"),
      tipoAccao: val(row, "tipoAccao"),
      prioridade: val(row, "prioridade"),
      pilar: val(row, "pilar"),
      motivo: val(row, "motivo"),
    });
  }
  return rows;
}
