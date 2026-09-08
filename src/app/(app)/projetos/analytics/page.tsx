"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Coins, Wallet, PiggyBank, Users } from "lucide-react";
import { api } from "@/lib/api";
import { formatNum, formatPct } from "@/lib/projetos";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

type ParPrevReal = { previsto: number; realizado: number };
type ProjetoAnalytics = {
  id: string;
  codigo: string | null;
  nome: string;
  dataInicio: string | null;
  dataFim: string | null;
  inscritos: number;
  receita: ParPrevReal;
  custo: ParPrevReal;
  margem: ParPrevReal;
  roiPct: number | null;
};
type Totais = {
  receita: ParPrevReal;
  custo: ParPrevReal;
  margem: ParPrevReal;
  inscritos: number;
};
type Resposta = { projetos: ProjetoAnalytics[]; totais: Totais };

const msg = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado");

/** Formata uma data ISO para dd/mm/aaaa (ou "—"). */
function fmtData(v: string | null): string {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-PT");
}

/** aaaa-mm-dd a partir de uma Date (para inputs de data). */
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default function AnalyticsProjetosPage() {
  const [dados, setDados] = useState<Resposta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const carregar = useCallback(async (de: string, ate: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (de) qs.set("from", de);
      if (ate) qs.set("to", ate);
      const url = "/api/projetos/analytics" + (qs.toString() ? `?${qs}` : "");
      const d = await api<Resposta>(url);
      setDados(d);
    } catch (e) {
      setError(msg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar("", "");
  }, [carregar]);

  function aplicar() {
    carregar(from, to);
  }

  function limpar() {
    setFrom("");
    setTo("");
    carregar("", "");
  }

  function presetAno() {
    const agora = new Date();
    const de = iso(new Date(agora.getFullYear(), 0, 1));
    const ate = iso(new Date(agora.getFullYear(), 11, 31));
    setFrom(de);
    setTo(ate);
    carregar(de, ate);
  }

  const totais = dados?.totais;
  const margemPct = useMemo(() => {
    if (!totais || totais.receita.realizado <= 0) return null;
    return (totais.margem.realizado / totais.receita.realizado) * 100;
  }, [totais]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Dados acumulados de custos, receita e margem dos projectos.
          </p>
        </div>
        <Link href="/projetos" className="text-sm text-brand-600 hover:underline">
          ← Projectos
        </Link>
      </div>

      {/* Filtro por período */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="w-40">
            <Label className="mb-1 block text-xs">De</Label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <div className="w-40">
            <Label className="mb-1 block text-xs">Até</Label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>
          <Button variant="navy" onClick={aplicar} disabled={loading}>
            Aplicar
          </Button>
          <Button variant="outline" onClick={presetAno} disabled={loading}>
            Este ano
          </Button>
          <Button variant="ghost" onClick={limpar} disabled={loading}>
            Tudo
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            Filtro pela data de início do projecto. Valores em AOA (realizado).
          </span>
        </CardContent>
      </Card>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && !dados ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            A carregar…
          </CardContent>
        </Card>
      ) : !dados || dados.projetos.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Sem projectos no período seleccionado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* KPIs acumulados */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              titulo="Receita (realizada)"
              valor={formatNum(totais!.receita.realizado)}
              sub={`Previsto: ${formatNum(totais!.receita.previsto)}`}
              Icon={Coins}
              cor="text-emerald-600"
              fundo="bg-emerald-50"
            />
            <Kpi
              titulo="Custo (realizado)"
              valor={formatNum(totais!.custo.realizado)}
              sub={`Previsto: ${formatNum(totais!.custo.previsto)}`}
              Icon={Wallet}
              cor="text-red-600"
              fundo="bg-red-50"
            />
            <Kpi
              titulo="Margem (realizada)"
              valor={formatNum(totais!.margem.realizado)}
              sub={`Previsto: ${formatNum(totais!.margem.previsto)}`}
              Icon={PiggyBank}
              cor={totais!.margem.realizado >= 0 ? "text-emerald-600" : "text-red-600"}
              fundo={totais!.margem.realizado >= 0 ? "bg-emerald-50" : "bg-red-50"}
            />
            <Kpi
              titulo="Margem %"
              valor={formatPct(margemPct, 1)}
              sub={`${dados.projetos.length} projecto(s) · ${totais!.inscritos} inscritos`}
              Icon={totais!.margem.realizado >= 0 ? TrendingUp : TrendingDown}
              cor={margemPct != null && margemPct >= 0 ? "text-brand-600" : "text-red-600"}
              fundo="bg-brand-50"
            />
          </div>

          {/* Totais: Previsto vs Realizado */}
          <Card>
            <CardContent className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-navy">
                Previsto vs Realizado (acumulado)
              </h2>
              <BarrasPrevReal totais={totais!} />
            </CardContent>
          </Card>

          {/* Receita vs Custo por projecto */}
          <Card>
            <CardContent className="p-4">
              <h2 className="mb-3 text-sm font-semibold text-navy">
                Por projecto — Receita vs Custo (realizado)
              </h2>
              <PorProjecto projetos={dados.projetos} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- KPI --------------------------------- */

function Kpi({
  titulo,
  valor,
  sub,
  Icon,
  cor,
  fundo,
}: {
  titulo: string;
  valor: string;
  sub?: string;
  Icon: React.ComponentType<{ className?: string }>;
  cor: string;
  fundo: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className={cn("grid h-7 w-7 place-items-center rounded-md", fundo, cor)}>
            <Icon className="h-4 w-4" />
          </span>
          <span className="text-xs font-medium text-muted-foreground">{titulo}</span>
        </div>
        <div className={cn("text-xl font-bold tabular-nums", cor)}>{valor}</div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
}

/* ----------------------- Gráfico: Previsto vs Realizado ----------------------- */

function BarrasPrevReal({ totais }: { totais: Totais }) {
  const linhas = [
    { label: "Receita", par: totais.receita, cor: "bg-emerald-500" },
    { label: "Custo", par: totais.custo, cor: "bg-red-500" },
    { label: "Margem", par: totais.margem, cor: "bg-brand-500" },
  ];
  const max = Math.max(
    1,
    ...linhas.flatMap((l) => [Math.abs(l.par.previsto), Math.abs(l.par.realizado)])
  );
  return (
    <div className="space-y-4">
      {linhas.map((l) => (
        <div key={l.label}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="font-medium text-slate-600">{l.label}</span>
            <span className="tabular-nums text-slate-500">
              Prev. {formatNum(l.par.previsto)} · Real. {formatNum(l.par.realizado)}
            </span>
          </div>
          <BarraDupla previsto={l.par.previsto} realizado={l.par.realizado} max={max} cor={l.cor} />
        </div>
      ))}
      <Legenda />
    </div>
  );
}

function BarraDupla({
  previsto,
  realizado,
  max,
  cor,
}: {
  previsto: number;
  realizado: number;
  max: number;
  cor: string;
}) {
  const pctP = Math.min(100, (Math.abs(previsto) / max) * 100);
  const pctR = Math.min(100, (Math.abs(realizado) / max) * 100);
  return (
    <div className="space-y-1">
      <div className="h-3 w-full overflow-hidden rounded bg-slate-100">
        <div className={cn("h-full rounded opacity-40", cor)} style={{ width: `${pctP}%` }} />
      </div>
      <div className="h-3 w-full overflow-hidden rounded bg-slate-100">
        <div className={cn("h-full rounded", cor)} style={{ width: `${pctR}%` }} />
      </div>
    </div>
  );
}

function Legenda() {
  return (
    <div className="flex items-center gap-4 text-xs text-muted-foreground">
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-4 rounded bg-slate-400 opacity-40" /> Previsto
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2.5 w-4 rounded bg-slate-500" /> Realizado
      </span>
    </div>
  );
}

/* ----------------------- Gráfico: por projecto ----------------------- */

function PorProjecto({ projetos }: { projetos: ProjetoAnalytics[] }) {
  const max = Math.max(
    1,
    ...projetos.flatMap((p) => [p.receita.realizado, p.custo.realizado])
  );
  return (
    <div className="space-y-3">
      {projetos.map((p) => {
        const margemNeg = p.margem.realizado < 0;
        return (
          <div key={p.id} className="border-b border-slate-100 pb-3 last:border-0 last:pb-0">
            <div className="mb-1 flex items-center justify-between gap-2 text-xs">
              <Link
                href={`/projetos/${p.id}`}
                className="truncate font-medium text-slate-700 hover:text-brand-600 hover:underline"
                title={p.nome}
              >
                {p.codigo ? `${p.codigo} · ` : ""}
                {p.nome}
              </Link>
              <span
                className={cn(
                  "shrink-0 tabular-nums font-semibold",
                  margemNeg ? "text-red-600" : "text-emerald-600"
                )}
              >
                Margem {formatNum(p.margem.realizado)}
              </span>
            </div>
            <div className="grid grid-cols-[3.5rem_1fr] items-center gap-2 text-[11px]">
              <span className="text-slate-400">Receita</span>
              <Barra valor={p.receita.realizado} max={max} cor="bg-emerald-500" />
              <span className="text-slate-400">Custo</span>
              <Barra valor={p.custo.realizado} max={max} cor="bg-red-500" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Barra({ valor, max, cor }: { valor: number; max: number; cor: string }) {
  const pct = Math.min(100, (Math.max(0, valor) / max) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="h-3 flex-1 overflow-hidden rounded bg-slate-100">
        <div className={cn("h-full rounded", cor)} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-24 shrink-0 text-right tabular-nums text-slate-500">
        {formatNum(valor)}
      </span>
    </div>
  );
}
