import "server-only";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import { TEMPLATE_BASE64 } from "./template.b64";

export type ListaPresencaInput = {
  assunto?: string;
  turma?: string;
  local?: string;
  data?: string;
  periodo?: string;
  horario?: string;
  /** Nomes dos participantes (linhas vazias são ignoradas). */
  participantes?: string[];
  /** Nº de linhas em branco extra (numeradas) para preenchimento manual no dia. */
  linhasEmBranco?: number;
};

// O template docxtemplater é gerado por scripts/build-lista-presenca-template.mjs
// e embutido em base64 (template.b64.ts) para funcionar nas serverless do Vercel.
let templateCache: Buffer | null = null;
function loadTemplate(): Buffer {
  if (!templateCache) templateCache = Buffer.from(TEMPLATE_BASE64, "base64");
  return templateCache;
}

function s(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Gera o .docx da Lista de Presença preenchido. */
export function gerarListaPresenca(input: ListaPresencaInput): Buffer {
  const nomes = (input.participantes ?? [])
    .map((n) => s(n))
    .filter((n) => n !== "");

  const extras = Math.max(0, Math.min(50, Number(input.linhasEmBranco) || 0));

  const participantes = [
    ...nomes.map((nome) => ({ nome })),
    ...Array.from({ length: extras }, () => ({ nome: "" })),
  ].map((p, i) => ({ numero: String(i + 1).padStart(2, "0"), nome: p.nome }));

  const zip = new PizZip(loadTemplate());
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  doc.render({
    assunto: s(input.assunto),
    turma: s(input.turma),
    local: s(input.local),
    data: s(input.data),
    periodo: s(input.periodo),
    horario: s(input.horario),
    participantes,
  });

  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
}
