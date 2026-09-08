"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { CalendarPlus, FileDown, Plus, Trash2, CalendarX } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/Modal";
import { IndicadorChart, fmt, type IndicadorRow } from "./IndicadorChart";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const msg = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado");
const selectCls =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type IndicadorBase = { id: string; titulo: string; temFilhos: boolean };
type ItemBase = { id: string; nome: string };
type Filho = { nome: string; valor: string };

/** Anos disponíveis: de 2026 ao ano actual (mínimo 2026). */
function anosDisponiveis(): number[] {
  const atual = new Date().getFullYear();
  const fim = Math.max(2026, atual);
  const out: number[] = [];
  for (let a = 2026; a <= fim; a++) out.push(a);
  return out;
}

export default function IndicadoresPage() {
  const [dados, setDados] = useState<IndicadorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtroAno, setFiltroAno] = useState("");
  const [filtroMes, setFiltroMes] = useState("");
  const gridRef = useRef<HTMLDivElement>(null);
  const anos = useMemo(anosDisponiveis, []);

  const carregar = useCallback(async (ano: string, mes: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (ano) qs.set("ano", ano);
      if (mes) qs.set("mes", mes);
      const url = "/api/indicadores" + (qs.toString() ? `?${qs}` : "");
      const d = await api<{ indicadores: IndicadorRow[] }>(url);
      setDados(d.indicadores);
    } catch (e) {
      setError(msg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar("", "");
  }, [carregar]);

  const recarregar = () => carregar(filtroAno, filtroMes);

  /* --------------------------- Modal: novo indicador --------------------------- */
  const [novoOpen, setNovoOpen] = useState(false);
  const [novo, setNovo] = useState({
    ano: String(new Date().getFullYear()),
    mes: "",
    titulo: "",
    tipoGrafico: "bar",
    valor: "",
    limite: "",
    detalhes: "",
    temFilhos: false,
  });
  const [filhos, setFilhos] = useState<Filho[]>([]);
  const [savingNovo, setSavingNovo] = useState(false);

  function abrirNovo() {
    setNovo({
      ano: String(new Date().getFullYear()),
      mes: "",
      titulo: "",
      tipoGrafico: "bar",
      valor: "",
      limite: "",
      detalhes: "",
      temFilhos: false,
    });
    setFilhos([]);
    setNovoOpen(true);
  }

  async function salvarIndicador() {
    if (!novo.ano || !novo.mes) return toast.error("Ano e mês são obrigatórios");
    if (!novo.titulo.trim()) return toast.error("O título é obrigatório");
    if (!novo.limite) return toast.error("O limite é obrigatório");

    const payload = {
      titulo: novo.titulo.trim(),
      tipoGrafico: novo.tipoGrafico,
      valor: Number(novo.valor) || 0,
      limite: Number(novo.limite) || 0,
      detalhes: novo.detalhes.trim() || null,
      ano: Number(novo.ano),
      mes: Number(novo.mes),
      temFilhos: novo.temFilhos,
      filhos: novo.temFilhos
        ? filhos
            .filter((f) => f.nome.trim())
            .map((f) => ({ nome: f.nome.trim(), valor: Number(f.valor) || 0 }))
        : [],
    };
    setSavingNovo(true);
    try {
      await api("/api/indicadores", { method: "POST", body: JSON.stringify(payload) });
      toast.success("Indicador criado");
      setNovoOpen(false);
      recarregar();
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setSavingNovo(false);
    }
  }

  /* --------------------------- Modal: associar período --------------------------- */
  const [periodoOpen, setPeriodoOpen] = useState(false);
  const [base, setBase] = useState<IndicadorBase[]>([]);
  const [periodo, setPeriodo] = useState({ indicadorId: "", ano: String(new Date().getFullYear()), mes: "" });
  const [itens, setItens] = useState<ItemBase[]>([]);
  const [itemValores, setItemValores] = useState<Record<string, string>>({});
  const [valorSimples, setValorSimples] = useState("");
  const [savingPeriodo, setSavingPeriodo] = useState(false);

  async function abrirPeriodo() {
    setPeriodo({ indicadorId: "", ano: String(new Date().getFullYear()), mes: "" });
    setItens([]);
    setItemValores({});
    setValorSimples("");
    setPeriodoOpen(true);
    try {
      const d = await api<{ indicadores: IndicadorBase[] }>("/api/indicadores/base");
      setBase(d.indicadores);
    } catch (e) {
      toast.error(msg(e));
    }
  }

  async function escolherIndicadorPeriodo(id: string) {
    setPeriodo((p) => ({ ...p, indicadorId: id }));
    setItens([]);
    setItemValores({});
    setValorSimples("");
    if (!id) return;
    try {
      const d = await api<{ itens: ItemBase[] }>(`/api/indicadores/${id}/itens`);
      setItens(d.itens);
    } catch {
      /* indicador simples ou erro — trata como sem itens */
    }
  }

  async function salvarPeriodo() {
    if (!periodo.indicadorId) return toast.error("Escolhe o indicador");
    if (!periodo.ano || !periodo.mes) return toast.error("Ano e mês são obrigatórios");
    const temItens = itens.length > 0;
    if (!temItens && valorSimples === "") return toast.error("Indica o valor");

    const payload = {
      indicadorId: periodo.indicadorId,
      ano: Number(periodo.ano),
      mes: Number(periodo.mes),
      itens: temItens
        ? Object.fromEntries(itens.map((it) => [it.id, Number(itemValores[it.id]) || 0]))
        : undefined,
      valor: temItens ? undefined : Number(valorSimples) || 0,
    };
    setSavingPeriodo(true);
    try {
      await api("/api/indicadores/periodo", { method: "POST", body: JSON.stringify(payload) });
      toast.success("Período lançado");
      setPeriodoOpen(false);
      recarregar();
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setSavingPeriodo(false);
    }
  }

  /* ------------------------------- Exclusões ------------------------------- */
  const [delIndicador, setDelIndicador] = useState<IndicadorRow | null>(null);
  const [delPeriodo, setDelPeriodo] = useState<IndicadorRow | null>(null);
  const [busyDel, setBusyDel] = useState(false);

  async function excluirIndicador() {
    if (!delIndicador) return;
    setBusyDel(true);
    try {
      await api(`/api/indicadores/${delIndicador.id}`, { method: "DELETE" });
      toast.success("Indicador removido");
      setDelIndicador(null);
      recarregar();
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setBusyDel(false);
    }
  }

  async function excluirPeriodo() {
    if (!delPeriodo) return;
    setBusyDel(true);
    try {
      await api("/api/indicadores/periodo/excluir", {
        method: "POST",
        body: JSON.stringify({ id: delPeriodo.id, ano: delPeriodo.ano, mes: delPeriodo.mes }),
      });
      toast.success("Período removido");
      setDelPeriodo(null);
      recarregar();
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setBusyDel(false);
    }
  }

  /* ------------------------------- Export PDF ------------------------------- */
  const [exporting, setExporting] = useState(false);
  async function exportarPDF() {
    const grid = gridRef.current;
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll<HTMLElement>(".card-indicador"));
    if (cards.length === 0) return toast.error("Nada para exportar");
    setExporting(true);
    try {
      const [{ jsPDF }, html2canvasMod] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);
      const html2canvas = html2canvasMod.default;
      const pdf = new jsPDF("l", "mm", "a4");
      const pageW = 297, pageH = 210, margin = 10, spacing = 10;
      const imgW = (pageW - margin * 2 - spacing) / 2;
      const imgH = 80;
      let x = margin, y = margin, count = 0;

      for (const card of cards) {
        const hidden = card.querySelectorAll<HTMLElement>("[data-noexport]");
        hidden.forEach((e) => (e.style.visibility = "hidden"));
        const canvas = await html2canvas(card, { scale: 2, backgroundColor: "#ffffff" });
        hidden.forEach((e) => (e.style.visibility = ""));
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", x, y, imgW, imgH);
        count++;
        if (count % 2 === 0) {
          x = margin;
          y += imgH + 20;
          if (y + imgH > pageH - margin) {
            pdf.addPage();
            y = margin;
          }
        } else {
          x += imgW + spacing;
        }
      }
      pdf.save("indicadores.pdf");
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setExporting(false);
    }
  }

  /* ---------------------------------- UI ---------------------------------- */
  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-navy">Indicadores de Qualidade</h1>
        <p className="text-sm text-muted-foreground">
          Indicadores da Academia — valores por ano/mês, com metas (limite) e subitens.
        </p>
      </div>

      {/* Filtros + acções */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="w-40">
            <Label className="mb-1 block text-xs">Ano</Label>
            <select className={selectCls} value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)}>
              <option value="">Todos os anos</option>
              {anos.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div className="w-44">
            <Label className="mb-1 block text-xs">Mês</Label>
            <select className={selectCls} value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)}>
              <option value="">Todos os meses</option>
              {MESES.map((m, idx) => (
                <option key={m} value={idx + 1}>{m}</option>
              ))}
            </select>
          </div>
          <Button variant="navy" onClick={recarregar} disabled={loading}>
            Filtrar
          </Button>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" onClick={abrirNovo}>
              <Plus className="h-4 w-4" /> Novo Indicador
            </Button>
            <Button variant="outline" onClick={abrirPeriodo}>
              <CalendarPlus className="h-4 w-4" /> Associar ao período
            </Button>
            <Button variant="secondary" onClick={exportarPDF} disabled={exporting}>
              <FileDown className="h-4 w-4" /> {exporting ? "A gerar…" : "Exportar PDF"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && dados.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">A carregar…</CardContent>
        </Card>
      ) : dados.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Sem indicadores para o período. Cria um indicador ou associa valores a um período.
          </CardContent>
        </Card>
      ) : (
        <div ref={gridRef} className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {dados.map((i) => (
            <Card key={`${i.id}-${i.ano}-${i.mes}`} className="card-indicador">
              <CardContent className="flex h-full flex-col p-4">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-navy">{i.titulo}</h3>
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                    {MESES[i.mes - 1]?.slice(0, 3)}/{i.ano}
                  </span>
                </div>
                {i.detalhes && (
                  <p className="mb-1 text-xs text-muted-foreground">{i.detalhes}</p>
                )}
                <div className="h-[200px] w-full">
                  <IndicadorChart i={i} />
                </div>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Meta: {fmt(i.limite)}</span>
                </div>
                <div className="mt-2 flex gap-2" data-noexport>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-amber-700"
                    onClick={() => setDelPeriodo(i)}
                  >
                    <CalendarX className="h-3.5 w-3.5" /> Excluir período
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    onClick={() => setDelIndicador(i)}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Excluir indicador
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ----------------------------- Modal Novo Indicador ----------------------------- */}
      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Indicador</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-xs">Ano</Label>
                <select className={selectCls} value={novo.ano} onChange={(e) => setNovo({ ...novo, ano: e.target.value })}>
                  <option value="">Selecione</option>
                  {anos.map((a) => (<option key={a} value={a}>{a}</option>))}
                </select>
              </div>
              <div>
                <Label className="mb-1 block text-xs">Mês</Label>
                <select className={selectCls} value={novo.mes} onChange={(e) => setNovo({ ...novo, mes: e.target.value })}>
                  <option value="">Selecione</option>
                  {MESES.map((m, idx) => (<option key={m} value={idx + 1}>{m}</option>))}
                </select>
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Indicador</Label>
              <Input value={novo.titulo} onChange={(e) => setNovo({ ...novo, titulo: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-xs">Tipo de Gráfico</Label>
                <select className={selectCls} value={novo.tipoGrafico} onChange={(e) => setNovo({ ...novo, tipoGrafico: e.target.value })}>
                  <option value="bar">Barra</option>
                  <option value="line">Linha</option>
                  <option value="pie">Pizza</option>
                </select>
              </div>
              <div>
                <Label className="mb-1 block text-xs">Limite (meta)</Label>
                <Input type="number" step="0.01" value={novo.limite} onChange={(e) => setNovo({ ...novo, limite: e.target.value })} />
              </div>
            </div>
            {!novo.temFilhos && (
              <div>
                <Label className="mb-1 block text-xs">Valor</Label>
                <Input type="number" step="0.01" value={novo.valor} onChange={(e) => setNovo({ ...novo, valor: e.target.value })} />
              </div>
            )}
            <div>
              <Label className="mb-1 block text-xs">Detalhes</Label>
              <Input value={novo.detalhes} onChange={(e) => setNovo({ ...novo, detalhes: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={novo.temFilhos}
                onChange={(e) => setNovo({ ...novo, temFilhos: e.target.checked })}
              />
              Possui subitens
            </label>
            {novo.temFilhos && (
              <div className="rounded-lg bg-slate-50 p-3">
                <Label className="mb-2 block text-xs">Subitens</Label>
                <div className="space-y-2">
                  {filhos.map((f, idx) => (
                    <div key={idx} className="flex gap-2">
                      <Input
                        placeholder="Nome"
                        value={f.nome}
                        onChange={(e) => setFilhos(filhos.map((x, i) => (i === idx ? { ...x, nome: e.target.value } : x)))}
                      />
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Valor"
                        className="w-28"
                        value={f.valor}
                        onChange={(e) => setFilhos(filhos.map((x, i) => (i === idx ? { ...x, valor: e.target.value } : x)))}
                      />
                      <Button variant="ghost" size="icon" onClick={() => setFilhos(filhos.filter((_, i) => i !== idx))}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => setFilhos([...filhos, { nome: "", valor: "" }])}>
                  <Plus className="h-4 w-4" /> Adicionar Subitem
                </Button>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoOpen(false)}>Fechar</Button>
            <Button variant="navy" onClick={salvarIndicador} disabled={savingNovo}>
              {savingNovo ? "A guardar…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ----------------------------- Modal Associar Período ----------------------------- */}
      <Dialog open={periodoOpen} onOpenChange={setPeriodoOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Período</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="mb-1 block text-xs">Indicador</Label>
              <select className={selectCls} value={periodo.indicadorId} onChange={(e) => escolherIndicadorPeriodo(e.target.value)}>
                <option value="">Selecione</option>
                {base.map((b) => (<option key={b.id} value={b.id}>{b.titulo}</option>))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-xs">Ano</Label>
                <select className={selectCls} value={periodo.ano} onChange={(e) => setPeriodo({ ...periodo, ano: e.target.value })}>
                  <option value="">Selecione</option>
                  {anos.map((a) => (<option key={a} value={a}>{a}</option>))}
                </select>
              </div>
              <div>
                <Label className="mb-1 block text-xs">Mês</Label>
                <select className={selectCls} value={periodo.mes} onChange={(e) => setPeriodo({ ...periodo, mes: e.target.value })}>
                  <option value="">Selecione</option>
                  {MESES.map((m, idx) => (<option key={m} value={idx + 1}>{m}</option>))}
                </select>
              </div>
            </div>
            {itens.length > 0 ? (
              <div className="rounded-lg bg-slate-50 p-3">
                <Label className="mb-2 block text-xs">Valores por subitem</Label>
                <div className="space-y-2">
                  {itens.map((it) => (
                    <div key={it.id} className="flex items-center gap-2">
                      <span className="w-1/2 text-sm text-slate-600">{it.nome}</span>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Valor"
                        value={itemValores[it.id] ?? ""}
                        onChange={(e) => setItemValores({ ...itemValores, [it.id]: e.target.value })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div>
                <Label className="mb-1 block text-xs">Valor</Label>
                <Input type="number" step="0.01" value={valorSimples} onChange={(e) => setValorSimples(e.target.value)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPeriodoOpen(false)}>Fechar</Button>
            <Button variant="navy" onClick={salvarPeriodo} disabled={savingPeriodo}>
              {savingPeriodo ? "A guardar…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------- Confirmações ------------------------------- */}
      {delIndicador && (
        <ConfirmDialog
          title="Excluir indicador"
          danger
          busy={busyDel}
          confirmLabel="Excluir"
          message={
            <>
              Excluir <b>{delIndicador.titulo}</b>? Todos os períodos e subitens
              associados também serão removidos.
            </>
          }
          onConfirm={excluirIndicador}
          onCancel={() => setDelIndicador(null)}
        />
      )}
      {delPeriodo && (
        <ConfirmDialog
          title="Excluir período"
          danger
          busy={busyDel}
          confirmLabel="Excluir"
          message={
            <>
              Excluir os dados de <b>{MESES[delPeriodo.mes - 1]}/{delPeriodo.ano}</b> do
              indicador <b>{delPeriodo.titulo}</b>?
            </>
          }
          onConfirm={excluirPeriodo}
          onCancel={() => setDelPeriodo(null)}
        />
      )}
    </div>
  );
}
