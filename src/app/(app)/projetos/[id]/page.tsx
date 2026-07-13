"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import {
  METAS,
  NIVEL_LABEL,
  desvioPct,
  formatAOA,
  formatNum,
  formatPct,
  type Nivel,
} from "@/lib/projetos";

type Indicadores = {
  inscritos: number;
  financeiro: {
    receita: { previsto: number; realizado: number };
    custo: { previsto: number; realizado: number };
    margem: { previsto: number; realizado: number };
    roiPct: number | null;
    custoPorFormando: number | null;
    breakEvenFormandos: number | null;
    custoRealizadoPct: number | null;
  };
  qualidade: Record<
    "nps" | "taxaConclusao" | "taxaPresenca" | "taxaAprovacao" | "avalFormador" | "reclamacoes",
    { valor: number | null; atingiu: boolean | null }
  >;
};

type Projeto = {
  id: string;
  nome: string;
  segmentoMercado: string | null;
  codigoTurma: string | null;
  cliente: { nome: string } | null;
  dataInicio: string | null;
  dataFim: string | null;
  duracaoHoras: number | null;
  modalidade: string | null;
  nivel: string | null;
  selecaoFormador: string | null;
  reclamacoes: number | null;
  avConteudo: number | null;
  avClareza: number | null;
  avMateriais: number | null;
  avOrganizacao: number | null;
  avAplicabilidade: number | null;
  comentarios: string | null;
  responsavelPedagogica: string | null;
  pilar: { nome: string } | null;
  local: { name: string } | null;
  formadores: { formador: { nome: string; tipo: string } }[];
  participantes: { origem: string | null; tipo: string }[];
  financeiro: { previsto: number; realizado: number; rubrica: { nome: string; tipo: string } }[];
};

const fDate = (v: string | null) =>
  v ? new Date(v).toLocaleDateString("pt-PT") : "—";

export default function RelatorioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [projeto, setProjeto] = useState<Projeto | null>(null);
  const [ind, setInd] = useState<Indicadores | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ projeto: Projeto; indicadores: Indicadores }>(`/api/projetos/${id}`)
      .then((d) => {
        setProjeto(d.projeto);
        setInd(d.indicadores);
      })
      .catch((e) => setError((e as Error).message));
  }, [id]);

  if (error)
    return (
      <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-200">
        {error}
      </div>
    );
  if (!projeto || !ind) return <div className="text-slate-400">Carregando…</div>;

  const fin = ind.financeiro;

  // Participantes agrupados por origem.
  const porOrigem = new Map<string, number>();
  projeto.participantes.forEach((p) => {
    const k = p.origem?.trim() || "Sem origem";
    porOrigem.set(k, (porOrigem.get(k) || 0) + 1);
  });

  const receitasFin = projeto.financeiro.filter((f) => f.rubrica.tipo === "RECEITA");
  const custosFin = projeto.financeiro.filter((f) => f.rubrica.tipo === "CUSTO");

  return (
    <div>
      {/* Barra de ações (não imprime) */}
      <div className="no-print flex items-center justify-between mb-4">
        <Link href="/projetos" className="text-sm text-brand-600 hover:underline">
          ← Projectos
        </Link>
        <div className="flex gap-2">
          <Link
            href={`/projetos/${id}/editar`}
            className="rounded-lg bg-white border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Editar
          </Link>
          <button
            onClick={() => window.print()}
            className="rounded-lg bg-navy text-white px-4 py-2 text-sm font-semibold hover:bg-navy-light"
          >
            Imprimir / PDF
          </button>
        </div>
      </div>

      {/* Folha do relatório */}
      <div className="print-area bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mx-auto max-w-[1100px]">
        {/* Cabeçalho */}
        <div className="flex items-start justify-between border-b border-slate-200 pb-3 mb-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/Logo.png" alt="Logo" className="h-9 object-contain" />
            <div>
              <h1 className="text-lg font-bold text-navy leading-tight">
                RELATÓRIO DE FORMAÇÃO
              </h1>
              <p className="text-xs text-slate-500">One Page Report · por Formação</p>
            </div>
          </div>
          <div className="text-right text-xs text-slate-500">
            <div>{projeto.nome}</div>
            <div>{fDate(projeto.dataInicio)}</div>
          </div>
        </div>

        {/* Cartões KPI */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          <Kpi label="Formandos Inscritos" value={String(ind.inscritos)} />
          <Kpi
            label="Taxa de Conclusão"
            value={formatPct(ind.qualidade.taxaConclusao.valor, 0)}
            ok={ind.qualidade.taxaConclusao.atingiu}
          />
          <Kpi
            label="NPS da Formação"
            value={ind.qualidade.nps.valor?.toString() ?? "—"}
            ok={ind.qualidade.nps.atingiu}
          />
          <Kpi label="Receita Gerada" value={formatAOA(fin.receita.realizado)} green />
          <Kpi
            label="ROI Previsto"
            value={fin.roiPct === null ? "—" : formatPct(fin.roiPct, 0)}
            ok={fin.roiPct === null ? null : fin.roiPct >= 0}
          />
        </div>

        {/* Três colunas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Identificação & Público */}
          <Bloco titulo="Identificação & Público">
            <Sub>Dados da Formação</Sub>
            <Linha k="Nome da Formação" v={projeto.nome} />
            <Linha k="Código da Turma" v={projeto.codigoTurma || "—"} />
            <Linha k="Segmento de Mercado" v={projeto.segmentoMercado || "—"} />
            <Linha k="Pilar" v={projeto.pilar?.nome || "—"} />
            <Linha k="Data de Início" v={fDate(projeto.dataInicio)} />
            <Linha k="Data de Fim" v={fDate(projeto.dataFim)} />
            <Linha
              k="Duração (horas)"
              v={projeto.duracaoHoras !== null ? String(projeto.duracaoHoras) : "—"}
            />
            <Linha k="Modalidade" v={projeto.modalidade || "—"} />
            <Linha k="Local / Sala" v={projeto.local?.name || "—"} />
            <Linha k="Cliente" v={projeto.cliente?.nome || "—"} />
            <Linha
              k="Formador / Corpo Técnico"
              v={
                projeto.formadores.length
                  ? projeto.formadores.map((f) => f.formador.nome).join(", ")
                  : projeto.selecaoFormador || "—"
              }
            />
            <Linha
              k="Nível"
              v={projeto.nivel ? NIVEL_LABEL[projeto.nivel as Nivel] : "—"}
            />

            <Sub>Participantes por Origem</Sub>
            <div className="text-sm">
              <div className="flex justify-between text-xs text-slate-400 font-medium pb-1">
                <span>Empresa / Departamento</span>
                <span>Inscritos</span>
              </div>
              {[...porOrigem.entries()].map(([origem, qtd]) => (
                <div key={origem} className="flex justify-between py-0.5">
                  <span className="text-slate-700">{origem}</span>
                  <span className="text-slate-700 font-medium">{qtd}</span>
                </div>
              ))}
              {porOrigem.size === 0 && (
                <div className="text-slate-400">Sem participantes.</div>
              )}
            </div>
          </Bloco>

          {/* Financeiro & ROI */}
          <Bloco titulo="Financeiro & ROI">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 text-left">
                  <th className="font-medium pb-1">Rubrica</th>
                  <th className="font-medium pb-1 text-right">Previsto (AOA)</th>
                  <th className="font-medium pb-1 text-right">Realizado (AOA)</th>
                  <th className="font-medium pb-1 text-right">Desvio (%)</th>
                </tr>
              </thead>
              <tbody>
                {receitasFin.map((f, i) => (
                  <FinLinha key={`r${i}`} f={f} green={/inscri/i.test(f.rubrica.nome)} />
                ))}
                {custosFin.map((f, i) => (
                  <FinLinha key={`c${i}`} f={f} custo />
                ))}
                <tr className="border-t border-slate-200 font-semibold text-slate-800">
                  <td className="py-1">Custo Total</td>
                  <td className="py-1 text-right">{formatNum(fin.custo.previsto)}</td>
                  <td className="py-1 text-right">{formatNum(fin.custo.realizado)}</td>
                  <td className="py-1 text-right"></td>
                </tr>
                <tr className="font-semibold text-slate-800">
                  <td className="py-1">Margem Bruta</td>
                  <td className="py-1 text-right">{formatNum(fin.margem.previsto)}</td>
                  <td className="py-1 text-right">{formatNum(fin.margem.realizado)}</td>
                  <td className="py-1 text-right"></td>
                </tr>
              </tbody>
            </table>

            <Sub>Análise de ROI</Sub>
            <Linha k="Investimento Total (custo)" v={formatAOA(fin.custo.previsto)} />
            <Linha k="Retorno Mensurável (receita)" v={formatAOA(fin.receita.realizado)} />
            <Linha
              k="Margem em Valor (AOA)"
              v={formatAOA(fin.receita.realizado - fin.custo.previsto)}
            />
            <Linha k="Custo por Formando" v={formatAOA(fin.custoPorFormando)} />
            <Linha
              k="Break-even (Formandos)"
              v={fin.breakEvenFormandos === null ? "—" : String(fin.breakEvenFormandos)}
            />
            <Linha
              k="Custo Realizado %"
              v={fin.custoRealizadoPct === null ? "—" : formatPct(fin.custoRealizadoPct, 0)}
            />
          </Bloco>

          {/* Qualidade & Avaliação */}
          <Bloco titulo="Qualidade & Avaliação">
            <Sub>Indicadores de Qualidade</Sub>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 text-left">
                  <th className="font-medium pb-1">Indicador</th>
                  <th className="font-medium pb-1">Meta</th>
                  <th className="font-medium pb-1 text-right">Real</th>
                </tr>
              </thead>
              <tbody>
                <QualLinha
                  nome="NPS da Formação"
                  meta={METAS.nps.label}
                  st={ind.qualidade.nps}
                />
                <QualLinha
                  nome="Taxa de Conclusão"
                  meta={METAS.taxaConclusao.label}
                  st={ind.qualidade.taxaConclusao}
                  pct
                />
                <QualLinha
                  nome="Taxa de Presença"
                  meta={METAS.taxaPresenca.label}
                  st={ind.qualidade.taxaPresenca}
                  pct
                />
                <QualLinha
                  nome="Taxa de Aprovação"
                  meta={METAS.taxaAprovacao.label}
                  st={ind.qualidade.taxaAprovacao}
                  pct
                />
                <QualLinha
                  nome="Aval. do Formador"
                  meta={METAS.avalFormador.label}
                  st={ind.qualidade.avalFormador}
                />
                <QualLinha
                  nome="Reclamações / Incidentes"
                  meta={METAS.reclamacoes.label}
                  st={ind.qualidade.reclamacoes}
                />
              </tbody>
            </table>

            <Sub>Avaliação por Critério (NPS Detalhado)</Sub>
            <Crit k="Conteúdo / Relevância" v={projeto.avConteudo} />
            <Crit k="Clareza do Formador" v={projeto.avClareza} />
            <Crit k="Materiais de Apoio" v={projeto.avMateriais} />
            <Crit k="Organização / Logística" v={projeto.avOrganizacao} />
            <Crit k="Aplicabilidade Prática" v={projeto.avAplicabilidade} />

            <Sub>Comentários / Observações</Sub>
            <p className="text-xs text-slate-600 whitespace-pre-wrap min-h-[2rem]">
              {projeto.comentarios || "—"}
            </p>
          </Bloco>
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between border-t border-slate-200 mt-5 pt-3 text-[11px] text-slate-400">
          <span>Confidencial · Academia TIS</span>
          <span>
            Responsável Pedagógica: {projeto.responsavelPedagogica || "—"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ Componentes ------------------------------- */

function Kpi({
  label,
  value,
  ok,
  green,
}: {
  label: string;
  value: string;
  ok?: boolean | null;
  green?: boolean;
}) {
  if (green) {
    return (
      <div className="rounded-xl border border-green-700 bg-green-600 px-3 py-2 text-center print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
        <div className="text-lg font-bold text-white leading-tight">{value}</div>
        <div className="text-[11px] text-green-50 leading-tight mt-0.5">{label}</div>
      </div>
    );
  }
  const ring =
    ok === true ? "border-green-300" : ok === false ? "border-red-300" : "border-slate-200";
  return (
    <div className={`rounded-xl border ${ring} bg-slate-50 px-3 py-2 text-center`}>
      <div className="text-lg font-bold text-navy leading-tight">{value}</div>
      <div className="text-[11px] text-slate-500 leading-tight mt-0.5">{label}</div>
    </div>
  );
}

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden">
      <div className="bg-navy text-white text-sm font-semibold px-3 py-2">{titulo}</div>
      <div className="p-3 space-y-1">{children}</div>
    </div>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase text-brand-700 bg-brand-50 rounded px-2 py-1 mt-3 mb-1">
      {children}
    </div>
  );
}

function Linha({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 text-sm py-0.5">
      <span className="text-slate-500">{k}</span>
      <span className="text-slate-800 font-medium text-right">{v}</span>
    </div>
  );
}

// Classe de cor do desvio. Nas receitas, positivo (realizado > previsto) é bom;
// nos custos é o contrário: gastar acima do previsto é mau.
function desvioClass(v: number | null, custo = false): string {
  if (v === null || v === 0) return "text-slate-600";
  const bom = custo ? v < 0 : v > 0;
  return bom ? "text-emerald-600" : "text-red-600";
}

function FinLinha({
  f,
  green,
  custo,
}: {
  f: { previsto: number; realizado: number; rubrica: { nome: string } };
  green?: boolean;
  custo?: boolean;
}) {
  const desvio = desvioPct(f.previsto, f.realizado);
  return (
    <tr className="border-t border-slate-100">
      <td className="py-1 text-slate-600">{f.rubrica.nome}</td>
      <td className="py-1 text-right text-slate-600">{formatNum(f.previsto)}</td>
      <td
        className={`py-1 text-right ${green ? "text-green-700 font-medium" : "text-slate-600"}`}
      >
        {formatNum(f.realizado)}
      </td>
      <td className={`py-1 text-right ${desvioClass(desvio, custo)}`}>
        {formatPct(desvio, 1)}
      </td>
    </tr>
  );
}

function QualLinha({
  nome,
  meta,
  st,
  pct,
}: {
  nome: string;
  meta: string;
  st: { valor: number | null; atingiu: boolean | null };
  pct?: boolean;
}) {
  const real =
    st.valor === null
      ? "—"
      : pct
        ? formatPct(st.valor, 0)
        : st.valor.toLocaleString("pt-PT");
  const cor =
    st.atingiu === true
      ? "text-green-600"
      : st.atingiu === false
        ? "text-red-600"
        : "text-slate-400";
  return (
    <tr className="border-t border-slate-100">
      <td className="py-1 text-slate-600">{nome}</td>
      <td className="py-1 text-slate-400">{meta}</td>
      <td className={`py-1 text-right font-semibold ${cor}`}>{real}</td>
    </tr>
  );
}

function Crit({ k, v }: { k: string; v: number | null }) {
  return (
    <div className="flex justify-between text-xs py-0.5">
      <span className="text-slate-600">{k}</span>
      <span className="text-slate-800 font-medium">
        {v === null || v === undefined ? "N/A" : v.toLocaleString("pt-PT")}
      </span>
    </div>
  );
}
