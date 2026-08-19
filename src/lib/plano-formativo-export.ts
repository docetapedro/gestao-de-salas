// Constrói o ficheiro Excel (.xlsx) do Plano Formativo — o "resumo" que o
// utilizador entrega à gestão. Reproduz o essencial da planilha original:
//   • Todos   — todas as inscrições (colunas originais + execução: turma/estado/datas)
//   • RESUMO  — nº de formandos por formação + totais e quebras
//   • Turmas  — todas as turmas com fornecedor/formador/datas/estado
// As antigas abas por formação são substituídas pelo AutoFiltro da folha "Todos".
import ExcelJS from "exceljs";
import {
  ESTADO_TURMA_LABEL,
  ESTADOS_INSCRICAO,
  COMPETENCIAS,
  TIPOS_ACCAO,
  PRIORIDADES,
} from "./plano-formativo";

type TurmaLite = {
  codigo: string | null;
  estado: string;
  entidade: string | null;
  formador: string | null;
  local: string | null;
  modalidade: string | null;
  duracaoHoras?: number | null;
  turno?: string | null;
  dataInicio: Date | null;
  dataFim: Date | null;
} | null;

export type ExportInscricao = {
  prioridade: string | null;
  motivo: string | null;
  estado: string;
  colaborador: {
    nome: string;
    funcao: string | null;
    direcao: string | null;
    area: string | null;
    liderancaDirecta: string | null;
  };
  formacao: {
    nome: string;
    competencia: string | null;
    tipoAccao: string | null;
    pilar: string | null;
    entidadeSugerida: string | null;
  };
  turma: TurmaLite;
};

export type ExportFormacao = {
  nome: string;
  competencia: string | null;
  tipoAccao: string | null;
  pilar: string | null;
  _count: { inscricoes: number };
  turmas: (NonNullable<TurmaLite> & { _count: { inscricoes: number } })[];
};

const NAVY = "FF1E293B";
const HEADER_TEXT = "FFFFFFFF";
const DATE_FMT = "dd/mm/yyyy";

const estadoInscricaoLabel = (v: string) =>
  ESTADOS_INSCRICAO.find((e) => e.value === v)?.label ?? v;
const estadoTurmaLabel = (v: string) => ESTADO_TURMA_LABEL[v as never] ?? v;

function styleHeader(row: ExcelJS.Row) {
  row.height = 22;
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: HEADER_TEXT }, size: 11 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
  });
}

/** Conta ocorrências de uma chave, ignorando nulos → rótulo "(não definido)". */
function contar<T>(itens: T[], fn: (i: T) => string | null): [string, number][] {
  const m = new Map<string, number>();
  for (const i of itens) {
    const k = fn(i) ?? "(não definido)";
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

/**
 * Nome de folha válido para Excel: ≤31 chars, sem os caracteres proibidos
 * (\ / ? * [ ] :) e único no livro. `used` acumula os já atribuídos (minúsculas).
 */
function safeSheetName(raw: string, prefix: string, used: Set<string>): string {
  const limpo = raw.replace(/[\\/?*[\]:]/g, " ").replace(/\s+/g, " ").trim();
  let base = `${prefix} ${limpo}`.trim().slice(0, 31).trim();
  if (!base) base = prefix || "Folha";
  let name = base;
  let n = 2;
  while (used.has(name.toLowerCase())) {
    const sufixo = `~${n++}`;
    name = `${base.slice(0, 31 - sufixo.length)}${sufixo}`;
  }
  used.add(name.toLowerCase());
  return name;
}

export async function buildPlanoFormativoWorkbook(
  inscricoes: ExportInscricao[],
  formacoes: ExportFormacao[]
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Academia TIS — Plano Formativo";

  /* ----------------------------- Todos ---------------------------------- */
  const todos = wb.addWorksheet("Todos", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  todos.columns = [
    { header: "DIRECÇÃO", key: "direcao", width: 26 },
    { header: "ÁREA", key: "area", width: 22 },
    { header: "NOME DO COLABORADOR", key: "nome", width: 30 },
    { header: "FUNÇÃO", key: "funcao", width: 22 },
    { header: "LIDERANÇA DIRECTA", key: "lideranca", width: 24 },
    { header: "DESIGNAÇÃO DA FORMAÇÃO", key: "formacao", width: 40 },
    { header: "COMPETÊNCIA", key: "competencia", width: 16 },
    { header: "ENTIDADE", key: "entidade", width: 22 },
    { header: "TIPO DE ACÇÃO", key: "tipo", width: 16 },
    { header: "PRIORIDADE", key: "prioridade", width: 12 },
    { header: "PILAR ESTRATÉGICO", key: "pilar", width: 20 },
    { header: "POR QUÊ?", key: "motivo", width: 50 },
    { header: "TURMA", key: "turma", width: 14 },
    { header: "ESTADO DA TURMA", key: "estadoTurma", width: 18 },
    { header: "FORNECEDOR", key: "fornecedor", width: 22 },
    { header: "FORMADOR", key: "formador", width: 22 },
    { header: "INÍCIO", key: "inicio", width: 12 },
    { header: "FIM", key: "fim", width: 12 },
    { header: "ESTADO INSCRIÇÃO", key: "estadoInsc", width: 16 },
  ];
  for (const i of inscricoes) {
    todos.addRow({
      direcao: i.colaborador.direcao,
      area: i.colaborador.area,
      nome: i.colaborador.nome,
      funcao: i.colaborador.funcao,
      lideranca: i.colaborador.liderancaDirecta,
      formacao: i.formacao.nome,
      competencia: i.formacao.competencia,
      entidade: i.turma?.entidade ?? i.formacao.entidadeSugerida,
      tipo: i.formacao.tipoAccao,
      prioridade: i.prioridade,
      pilar: i.formacao.pilar,
      motivo: i.motivo,
      turma: i.turma?.codigo ?? null,
      estadoTurma: i.turma ? estadoTurmaLabel(i.turma.estado) : null,
      fornecedor: i.turma?.entidade ?? null,
      formador: i.turma?.formador ?? null,
      inicio: i.turma?.dataInicio ?? null,
      fim: i.turma?.dataFim ?? null,
      estadoInsc: estadoInscricaoLabel(i.estado),
    });
  }
  styleHeader(todos.getRow(1));
  todos.getColumn("inicio").numFmt = DATE_FMT;
  todos.getColumn("fim").numFmt = DATE_FMT;
  todos.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 19 } };

  /* ----------------------------- RESUMO --------------------------------- */
  const resumo = wb.addWorksheet("RESUMO");
  resumo.columns = [
    { header: "Nº", key: "n", width: 6 },
    { header: "FORMAÇÃO", key: "formacao", width: 46 },
    { header: "Nº FORMANDOS", key: "formandos", width: 14 },
    { header: "COMPETÊNCIA", key: "competencia", width: 16 },
    { header: "PILAR", key: "pilar", width: 20 },
    { header: "TIPO", key: "tipo", width: 16 },
    { header: "Nº TURMAS", key: "turmas", width: 11 },
  ];
  const ordenadas = [...formacoes].sort(
    (a, b) => b._count.inscricoes - a._count.inscricoes
  );
  // Nome de folha por formação (numerado = mesmo Nº do RESUMO) para cruzar dados.
  const usados = new Set<string>(["todos", "resumo", "turmas"]);
  const nomeFolha = new Map<string, string>();
  ordenadas.forEach((f, idx) =>
    nomeFolha.set(f.nome, safeSheetName(f.nome, String(idx + 1), usados))
  );

  ordenadas.forEach((f, idx) => {
    const row = resumo.addRow({
      n: idx + 1,
      formandos: f._count.inscricoes,
      competencia: f.competencia,
      pilar: f.pilar,
      tipo: f.tipoAccao,
      turmas: f.turmas.length,
    });
    // Formação como hiperligação interna para a sua folha.
    const cell = row.getCell("formacao");
    cell.value = { text: f.nome, hyperlink: `#'${nomeFolha.get(f.nome)}'!A1` };
    cell.font = { color: { argb: "FF2563EB" }, underline: true };
  });
  styleHeader(resumo.getRow(1));

  const totalFormandos = inscricoes.length;
  const totalTurmas = formacoes.reduce((s, f) => s + f.turmas.length, 0);
  resumo.addRow({});
  const totalRow = resumo.addRow({
    formacao: "TOTAL",
    formandos: totalFormandos,
    turmas: totalTurmas,
  });
  totalRow.font = { bold: true };

  // Quebras (por competência / pilar / direcção) numa segunda zona.
  resumo.addRow({});
  const escreverQuebra = (titulo: string, dados: [string, number][]) => {
    const cab = resumo.addRow({ formacao: titulo });
    cab.font = { bold: true };
    dados.forEach(([k, v]) => resumo.addRow({ formacao: k, formandos: v }));
  };
  escreverQuebra(
    "Por competência",
    contar(inscricoes, (i) => i.formacao.competencia)
  );
  resumo.addRow({});
  escreverQuebra("Por pilar", contar(inscricoes, (i) => i.formacao.pilar));
  resumo.addRow({});
  escreverQuebra(
    "Por direcção",
    contar(inscricoes, (i) => i.colaborador.direcao)
  );

  /* ----------------------------- Turmas --------------------------------- */
  const turmas = wb.addWorksheet("Turmas", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  turmas.columns = [
    { header: "FORMAÇÃO", key: "formacao", width: 40 },
    { header: "TURMA", key: "turma", width: 14 },
    { header: "ESTADO", key: "estado", width: 18 },
    { header: "FORNECEDOR", key: "fornecedor", width: 22 },
    { header: "FORMADOR", key: "formador", width: 22 },
    { header: "LOCAL", key: "local", width: 20 },
    { header: "MODALIDADE", key: "modalidade", width: 14 },
    { header: "CARGA HORÁRIA", key: "carga", width: 14 },
    { header: "TURNO", key: "turno", width: 10 },
    { header: "INÍCIO", key: "inicio", width: 12 },
    { header: "FIM", key: "fim", width: 12 },
    { header: "Nº FORMANDOS", key: "formandos", width: 14 },
  ];
  for (const f of formacoes) {
    for (const t of f.turmas) {
      turmas.addRow({
        formacao: f.nome,
        turma: t.codigo,
        estado: estadoTurmaLabel(t.estado),
        fornecedor: t.entidade,
        formador: t.formador,
        local: t.local,
        modalidade: t.modalidade,
        carga: t.duracaoHoras ?? null,
        turno: t.turno ?? null,
        inicio: t.dataInicio,
        fim: t.dataFim,
        formandos: t._count.inscricoes,
      });
    }
  }
  styleHeader(turmas.getRow(1));
  turmas.getColumn("inicio").numFmt = DATE_FMT;
  turmas.getColumn("fim").numFmt = DATE_FMT;
  if (turmas.rowCount > 1)
    turmas.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 12 } };

  /* -------------------- Uma folha por formação -------------------------- */
  // Inscrições agrupadas por nome de formação (o nome é único no catálogo).
  const porFormacao = new Map<string, ExportInscricao[]>();
  for (const i of inscricoes) {
    const arr = porFormacao.get(i.formacao.nome) ?? [];
    arr.push(i);
    porFormacao.set(i.formacao.nome, arr);
  }

  ordenadas.forEach((f, idx) => {
    const ws = wb.addWorksheet(nomeFolha.get(f.nome)!, {
      views: [{ state: "frozen", ySplit: 4 }],
    });
    // Título + metadados da formação.
    ws.mergeCells("A1:M1");
    const titulo = ws.getCell("A1");
    titulo.value = `${idx + 1}. ${f.nome}`;
    titulo.font = { bold: true, size: 13, color: { argb: NAVY } };
    ws.getCell("A2").value = [
      f.competencia && `Competência: ${f.competencia}`,
      f.tipoAccao && `Tipo: ${f.tipoAccao}`,
      f.pilar && `Pilar: ${f.pilar}`,
      `Formandos: ${f._count.inscricoes}`,
      `Turmas: ${f.turmas.length}`,
    ]
      .filter(Boolean)
      .join("   •   ");
    ws.getCell("A2").font = { color: { argb: "FF64748B" }, size: 10 };

    ws.getRow(4).values = [
      "NOME DO COLABORADOR",
      "FUNÇÃO",
      "DIRECÇÃO",
      "ÁREA",
      "LIDERANÇA DIRECTA",
      "PRIORIDADE",
      "TURMA",
      "ESTADO DA TURMA",
      "FORMADOR",
      "INÍCIO",
      "FIM",
      "ESTADO INSCRIÇÃO",
      "POR QUÊ?",
    ];
    const larguras = [30, 22, 24, 20, 22, 12, 12, 16, 20, 12, 12, 16, 46];
    larguras.forEach((w, c) => (ws.getColumn(c + 1).width = w));
    styleHeader(ws.getRow(4));

    for (const i of porFormacao.get(f.nome) ?? []) {
      const r = ws.addRow([
        i.colaborador.nome,
        i.colaborador.funcao,
        i.colaborador.direcao,
        i.colaborador.area,
        i.colaborador.liderancaDirecta,
        i.prioridade,
        i.turma?.codigo ?? null,
        i.turma ? estadoTurmaLabel(i.turma.estado) : null,
        i.turma?.formador ?? null,
        i.turma?.dataInicio ?? null,
        i.turma?.dataFim ?? null,
        estadoInscricaoLabel(i.estado),
        i.motivo,
      ]);
      r.getCell(10).numFmt = DATE_FMT;
      r.getCell(11).numFmt = DATE_FMT;
    }
    // Ligação de regresso ao RESUMO.
    const volta = ws.getCell("O1");
    volta.value = { text: "↩ RESUMO", hyperlink: "#RESUMO!A1" };
    volta.font = { color: { argb: "FF2563EB" }, underline: true };
  });

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}

/* ========================================================================== */
/* Modelo (template) de importação — para preencher e importar necessidades.  */
/* Colunas iguais às que o import lê (aba "Todos" original).                    */
/* ========================================================================== */
export async function buildImportTemplateWorkbook(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Academia TIS — Plano Formativo";

  const ws = wb.addWorksheet("Inscrições", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  ws.columns = [
    { header: "DIRECÇÃO", key: "direcao", width: 26 },
    { header: "ÁREA", key: "area", width: 22 },
    { header: "NOME DO COLABORADOR", key: "nome", width: 30 },
    { header: "FUNÇÃO", key: "funcao", width: 22 },
    { header: "LIDERANÇA DIRECTA", key: "lideranca", width: 24 },
    { header: "DESIGNAÇÃO DA FORMAÇÃO", key: "formacao", width: 40 },
    { header: "COMPETÊNCIA", key: "competencia", width: 16 },
    { header: "ENTIDADE", key: "entidade", width: 22 },
    { header: "TIPO DE ACÇÃO", key: "tipo", width: 16 },
    { header: "PRIORIDADE", key: "prioridade", width: 12 },
    { header: "PILAR ESTRATÉGICO", key: "pilar", width: 20 },
    { header: "POR QUÊ?", key: "motivo", width: 50 },
  ];
  styleHeader(ws.getRow(1));

  // Linha de exemplo (a apagar antes de importar).
  const exemplo = ws.addRow({
    direcao: "Digital & Software Engineering",
    area: "BD e Interoperabilidade",
    nome: "(exemplo) Maria Silva",
    funcao: "Consultora DBA",
    lideranca: "Rodrigo Vivas",
    formacao: "Administração com PostgreSQL",
    competencia: "Técnica",
    entidade: "Plataforma Alura",
    tipo: "Treinamento",
    prioridade: "Alta",
    pilar: "Tecnologia",
    motivo: "Actualização de competências",
  });
  exemplo.eachCell((c) => (c.font = { italic: true, color: { argb: "FF94A3B8" } }));

  // Listas suspensas (Competência col G, Tipo col I, Prioridade col J) até à linha 500.
  const lista = (arr: readonly string[]) => `"${arr.join(",")}"`;
  for (let r = 2; r <= 500; r++) {
    ws.getCell(`G${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [lista(COMPETENCIAS)],
    };
    ws.getCell(`I${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [lista(TIPOS_ACCAO)],
    };
    ws.getCell(`J${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [lista(PRIORIDADES)],
    };
  }

  /* --------------------------- Instruções ------------------------------- */
  const inst = wb.addWorksheet("Instruções");
  inst.getColumn(1).width = 100;
  const linhas: [string, boolean][] = [
    ["Como preencher o modelo do Plano Formativo", true],
    ["", false],
    ["1. Preencha uma linha por necessidade: um colaborador + uma formação.", false],
    ["2. Obrigatórios: NOME DO COLABORADOR e DESIGNAÇÃO DA FORMAÇÃO. As restantes colunas são opcionais.", false],
    ["3. COMPETÊNCIA, TIPO DE ACÇÃO e PRIORIDADE têm lista suspensa — escolha um valor.", false],
    [`   • COMPETÊNCIA: ${COMPETENCIAS.join(" / ")}`, false],
    [`   • TIPO DE ACÇÃO: ${TIPOS_ACCAO.join(" / ")}`, false],
    [`   • PRIORIDADE: ${PRIORIDADES.join(" / ")}`, false],
    ["4. Apague a linha de exemplo (a cinzento) antes de importar.", false],
    ["5. A mesma pessoa pode repetir uma formação em anos diferentes, mas não no mesmo ano.", false],
    ["6. Guarde o ficheiro e entregue-o ao gestor do Plano Formativo para importação.", false],
  ];
  linhas.forEach(([txt, bold]) => {
    const row = inst.addRow([txt]);
    if (bold) row.getCell(1).font = { bold: true, size: 13, color: { argb: NAVY } };
  });

  const arrayBuffer = await wb.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
