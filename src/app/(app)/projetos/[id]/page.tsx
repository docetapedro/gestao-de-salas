"use client";

import { use, useCallback, useEffect, useState } from "react";
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
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import GestaoTurmas, {
  type Rubrica as RubricaTipo,
  type Turma,
} from "@/components/GestaoTurmas";
import {
  Users,
  GraduationCap,
  Gauge,
  Wallet,
  TrendingUp,
  ClipboardList,
  Coins,
  Award,
  type LucideIcon,
} from "lucide-react";

type Indicadores = {
  inscritos: number;
  concluidos: number;
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
  codigo: string | null;
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
  participantes: { origem: string | null; tipo: string; quantidade: number; concluidos: number }[];
  financeiro: { previsto: number; realizado: number; rubrica: { nome: string; tipo: string } }[];
  turmas: Turma[];
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
  const [rubricas, setRubricas] = useState<RubricaTipo[]>([]);
  const [error, setError] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const d = await api<{ projeto: Projeto; indicadores: Indicadores }>(
      `/api/projetos/${id}`
    );
    setProjeto(d.projeto);
    setInd(d.indicadores);
  }, [id]);

  useEffect(() => {
    carregar().catch((e) => setError((e as Error).message));
    api<{ rubricas: RubricaTipo[] }>("/api/rubricas")
      .then((d) => setRubricas(d.rubricas))
      .catch(() => {});
  }, [carregar]);

  if (error)
    return (
      <div className="rounded-lg bg-destructive/10 text-destructive text-sm px-3 py-2 border border-destructive/20">
        {error}
      </div>
    );
  if (!projeto || !ind)
    return <div className="text-muted-foreground">Carregando…</div>;

  const fin = ind.financeiro;

  // Participantes agrupados por origem.
  const porOrigem = new Map<string, { inscritos: number; concluidos: number }>();
  projeto.participantes.forEach((p) => {
    const k = p.origem?.trim() || "Sem origem";
    const cur = porOrigem.get(k) || { inscritos: 0, concluidos: 0 };
    porOrigem.set(k, {
      inscritos: cur.inscritos + (p.quantidade ?? 1),
      concluidos: cur.concluidos + (p.concluidos ?? 0),
    });
  });

  const receitasFin = projeto.financeiro.filter((f) => f.rubrica.tipo === "RECEITA");
  const custosFin = projeto.financeiro.filter((f) => f.rubrica.tipo === "CUSTO");

  return (
    <div>
      {/* Voltar (não imprime) */}
      <div className="no-print mb-3">
        <Link
          href="/projetos"
          className="text-sm text-brand-600 hover:underline"
        >
          ← Projectos
        </Link>
      </div>

      {/* Gestão de turmas e lançamentos (não imprime).
          Editar/Imprimir vão na mesma linha do "Nova turma". */}
      <GestaoTurmas
        projetoId={projeto.id}
        turmas={projeto.turmas}
        rubricas={rubricas}
        onReload={carregar}
        extraActions={
          <>
            <Button asChild variant="outline" size="sm">
              <Link href={`/projetos/${id}/editar`}>Editar</Link>
            </Button>
            <Button variant="navy" size="sm" onClick={() => window.print()}>
              Imprimir / PDF
            </Button>
          </>
        }
      />

      {/* Folha do relatório */}
      <Card className="print-area w-full rounded-2xl p-6">
        {/* Cabeçalho */}
        <div className="mb-5 flex items-center justify-between gap-4 rounded-xl bg-gradient-to-r from-navy via-navy to-navy-light px-5 py-4 text-white print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/Logo.png" alt="Logo" className="h-10 object-contain" />
            <div className="border-l border-white/20 pl-3">
              <h1 className="text-xl font-bold leading-tight tracking-tight">
                RELATÓRIO DE FORMAÇÃO
              </h1>
              <p className="text-xs text-brand-100">{projeto.nome}</p>
            </div>
          </div>
          <div className="text-right">
            {projeto.codigo && (
              <div className="inline-block rounded-md bg-white/15 px-2.5 py-0.5 text-sm font-semibold tracking-wide">
                {projeto.codigo}
              </div>
            )}
            <div className="mt-1 text-[11px] text-brand-100">
              {fDate(projeto.dataInicio)} — {fDate(projeto.dataFim)}
            </div>
          </div>
        </div>

        {/* Cartões KPI */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          <Kpi label="Formandos Inscritos" value={String(ind.inscritos)} Icon={Users} />
          <Kpi
            label="Taxa de Conclusão"
            value={formatPct(ind.qualidade.taxaConclusao.valor, 0)}
            Icon={GraduationCap}
            ok={ind.qualidade.taxaConclusao.atingiu}
          />
          <Kpi
            label="NPS da Formação"
            value={ind.qualidade.nps.valor?.toString() ?? "—"}
            Icon={Gauge}
            ok={ind.qualidade.nps.atingiu}
          />
          <Kpi
            label="Receita Gerada"
            value={formatAOA(fin.receita.realizado)}
            Icon={Wallet}
            green
          />
          <Kpi
            label="ROI Previsto"
            value={fin.roiPct === null ? "—" : formatPct(fin.roiPct, 0)}
            Icon={TrendingUp}
            ok={fin.roiPct === null ? null : fin.roiPct >= 0}
          />
        </div>

        {/* Três colunas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Identificação & Público */}
          <Bloco titulo="Identificação & Público" Icon={ClipboardList}>
            <Sub>Dados da Formação</Sub>
            <Linha k="Código do Projecto" v={projeto.codigo || "—"} />
            <Linha k="Nome do Projecto" v={projeto.nome} />
            <Linha
              k={projeto.turmas.length > 1 ? "Turmas" : "Turma"}
              v={
                projeto.turmas.length
                  ? projeto.turmas.map((t) => t.codigo || "—").join(", ")
                  : projeto.codigoTurma || "—"
              }
            />
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
                <span>Inscritos / Concl.</span>
              </div>
              {[...porOrigem.entries()].map(([origem, v]) => (
                <div key={origem} className="flex justify-between py-0.5">
                  <span className="text-slate-700">{origem}</span>
                  <span className="text-slate-700 font-medium">
                    {v.inscritos} / {v.concluidos}
                  </span>
                </div>
              ))}
              {porOrigem.size === 0 && (
                <div className="text-slate-400">Sem participantes.</div>
              )}
            </div>
          </Bloco>

          {/* Financeiro & ROI */}
          <Bloco titulo="Financeiro & ROI" Icon={Coins}>
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
            <Linha k="Investimento Total (custo)" v={formatAOA(fin.custo.realizado)} />
            <Linha k="Retorno Mensurável (receita)" v={formatAOA(fin.receita.realizado)} />
            <Linha
              k="Margem em Valor (AOA)"
              v={formatAOA(fin.receita.realizado - fin.custo.realizado)}
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
          <Bloco titulo="Qualidade & Avaliação" Icon={Award}>
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
            <p className="text-xs text-slate-700 whitespace-pre-wrap min-h-[2rem]">
              {projeto.comentarios || "—"}
            </p>
          </Bloco>
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between border-t border-slate-200 mt-5 pt-3 text-[11px] text-muted-foreground">
          <span>Confidencial · Academia TIS</span>
          <span>
            Responsável Pedagógica: {projeto.responsavelPedagogica || "—"}
          </span>
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------ Componentes ------------------------------- */

const KPI_TONES = {
  slate: { bg: "bg-slate-100", icon: "text-slate-500", ring: "ring-slate-200", accent: "from-slate-500/10", value: "text-navy" },
  indigo: { bg: "bg-brand-50", icon: "text-brand-600", ring: "ring-brand-100", accent: "from-brand-500/10", value: "text-navy" },
  emerald: { bg: "bg-emerald-50", icon: "text-emerald-600", ring: "ring-emerald-100", accent: "from-emerald-500/10", value: "text-emerald-700" },
  rose: { bg: "bg-rose-50", icon: "text-rose-600", ring: "ring-rose-100", accent: "from-rose-500/10", value: "text-rose-700" },
} as const;

function Kpi({
  label,
  value,
  Icon,
  ok,
  green,
}: {
  label: string;
  value: string;
  Icon: LucideIcon;
  ok?: boolean | null;
  green?: boolean;
}) {
  const toneName =
    green || ok === true ? "emerald" : ok === false ? "rose" : "indigo";
  const t = KPI_TONES[toneName];
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
      <div
        className={cn(
          "pointer-events-none absolute inset-0 bg-gradient-to-br to-transparent",
          t.accent
        )}
      />
      <div className="relative flex items-center gap-3">
        <div
          className={cn(
            "grid h-10 w-10 shrink-0 place-items-center rounded-lg ring-4",
            t.bg,
            t.ring
          )}
        >
          <Icon size={18} className={t.icon} />
        </div>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {label}
          </div>
          <div className={cn("truncate text-lg font-extrabold leading-tight", t.value)}>
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}

function Bloco({
  titulo,
  Icon,
  children,
}: {
  titulo: string;
  Icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex-row items-center gap-2 space-y-0 bg-navy px-3 py-2 print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/10">
          <Icon size={14} className="text-brand-100" />
        </span>
        <CardTitle className="text-sm font-semibold text-white">
          {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-3 space-y-1">{children}</CardContent>
    </Card>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-wide text-brand-700 bg-brand-50 rounded px-2 py-1 mt-3 mb-1 print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]">
      {children}
    </div>
  );
}

function Linha({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2 text-sm py-0.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-slate-800 font-medium text-right">{v}</span>
    </div>
  );
}

// Diz se o desvio é favorável. Nas receitas, positivo (realizado > previsto) é bom;
// nos custos é o contrário: gastar abaixo do previsto é bom.
function desvioBom(v: number | null, custo = false): boolean | null {
  if (v === null || v === 0) return null;
  return custo ? v < 0 : v > 0;
}

function desvioClass(v: number | null, custo = false): string {
  const bom = desvioBom(v, custo);
  if (bom === null) return "text-slate-600";
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
  const bom = desvioBom(desvio, custo);
  // Quando o desvio é favorável (verde), mostramos a magnitude sem sinal negativo.
  const desvioMostrado =
    bom === true && desvio !== null ? Math.abs(desvio) : desvio;
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
        {formatPct(desvioMostrado, 1)}
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
  const variant =
    st.atingiu === true
      ? "success"
      : st.atingiu === false
        ? "destructive"
        : "secondary";
  return (
    <tr className="border-t border-slate-100">
      <td className="py-1 text-slate-600">{nome}</td>
      <td className="py-1 text-muted-foreground">{meta}</td>
      <td className="py-1 text-right">
        <Badge
          variant={variant}
          className="rounded-md px-1.5 py-0 font-semibold print:[-webkit-print-color-adjust:exact] print:[print-color-adjust:exact]"
        >
          {real}
        </Badge>
      </td>
    </tr>
  );
}

function Crit({ k, v }: { k: string; v: number | null }) {
  return (
    <div className="flex justify-between text-xs py-0.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="text-slate-800 font-medium">
        {v === null || v === undefined ? "N/A" : v.toLocaleString("pt-PT")}
      </span>
    </div>
  );
}
