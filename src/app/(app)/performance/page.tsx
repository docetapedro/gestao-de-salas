"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileDown, Plus, Save, Settings2, Trash2, Columns3 } from "lucide-react";
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

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const TIPOS = ["PERCENTAGEM", "NUMERO", "HORAS", "MOEDA", "PREVISTO_REALIZADO"] as const;
type Tipo = (typeof TIPOS)[number];
const TIPO_LABELS: Record<Tipo, string> = {
  PERCENTAGEM: "Percentagem (%)",
  NUMERO: "Número",
  HORAS: "Horas",
  MOEDA: "Moeda (Kz)",
  PREVISTO_REALIZADO: "Previsto vs Realizado",
};

const msg = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado");
const selectCls =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Indicador = {
  id: string;
  ordem: number;
  titulo: string;
  tipo: Tipo;
  usaHoras: boolean;
  usaSegmentos: boolean;
  unidade: string | null;
  ativo: boolean;
};
type Segmento = { id: string; nome: string; ordem: number; ativo: boolean };
type ValorApi = {
  resultado: number | null;
  resultado2: number | null;
  horas: number | null;
  horasTotal: number | null;
  texto: string | null;
  segmentos: Record<string, number | null>;
};
type RowDraft = {
  resultado: string;
  resultado2: string;
  horas: string;
  horasTotal: string;
  segmentos: Record<string, string>;
};

const s = (n: number | null | undefined) => (n === null || n === undefined ? "" : String(n));

/** Anos disponíveis: de 2026 ao ano actual (mínimo 2026). */
function anosDisponiveis(): number[] {
  const atual = new Date().getFullYear();
  const fim = Math.max(2026, atual);
  const out: number[] = [];
  for (let a = 2026; a <= fim; a++) out.push(a);
  return out;
}

export default function PerformancePage() {
  const anos = useMemo(anosDisponiveis, []);
  const [filtroAno, setFiltroAno] = useState(() => String(new Date().getFullYear()));
  const [filtroMes, setFiltroMes] = useState(() => String(new Date().getMonth() + 1));

  const [indicadores, setIndicadores] = useState<Indicador[]>([]);
  const [segmentos, setSegmentos] = useState<Segmento[]>([]);
  const [draft, setDraft] = useState<Record<string, RowDraft>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Mostra a coluna "Horas" só se algum indicador visível a usar.
  const mostrarHoras = useMemo(() => indicadores.some((i) => i.usaHoras), [indicadores]);

  const carregar = useCallback(async (ano: string, mes: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (ano) qs.set("ano", ano);
      if (mes) qs.set("mes", mes);
      const d = await api<{
        indicadores: Indicador[];
        segmentos: Segmento[];
        valores: Record<string, ValorApi>;
      }>(`/api/performance?${qs}`);
      setIndicadores(d.indicadores);
      setSegmentos(d.segmentos);
      // Constrói o rascunho editável a partir dos valores existentes.
      const nd: Record<string, RowDraft> = {};
      for (const ind of d.indicadores) {
        const v = d.valores[ind.id];
        nd[ind.id] = {
          resultado: s(v?.resultado),
          resultado2: s(v?.resultado2),
          horas: s(v?.horas),
          horasTotal: s(v?.horasTotal),
          segmentos: Object.fromEntries(
            d.segmentos.map((seg) => [seg.id, s(v?.segmentos?.[seg.id])])
          ),
        };
      }
      setDraft(nd);
    } catch (e) {
      setError(msg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar(filtroAno, filtroMes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregar]);

  const recarregar = () => carregar(filtroAno, filtroMes);

  function setCampo(indId: string, campo: keyof Omit<RowDraft, "segmentos">, valor: string) {
    setDraft((d) => ({ ...d, [indId]: { ...d[indId], [campo]: valor } }));
  }
  function setSeg(indId: string, segId: string, valor: string) {
    setDraft((d) => ({
      ...d,
      [indId]: { ...d[indId], segmentos: { ...d[indId].segmentos, [segId]: valor } },
    }));
  }

  async function guardar() {
    if (!filtroAno || !filtroMes) return toast.error("Escolhe o ano e o mês");
    const payload = {
      ano: Number(filtroAno),
      mes: Number(filtroMes),
      valores: indicadores.map((ind) => {
        const r = draft[ind.id];
        return {
          indicadorId: ind.id,
          resultado: r?.resultado ?? "",
          resultado2: r?.resultado2 ?? "",
          horas: r?.horas ?? "",
          horasTotal: r?.horasTotal ?? "",
          segmentos: r?.segmentos ?? {},
        };
      }),
    };
    setSaving(true);
    try {
      await api("/api/performance/valores", { method: "POST", body: JSON.stringify(payload) });
      toast.success("Quadro guardado");
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setSaving(false);
    }
  }

  /* ------------------------------- Export PDF ------------------------------- */
  const [exporting, setExporting] = useState(false);
  async function exportarPDF() {
    const el = tableRef.current;
    if (!el) return;
    setExporting(true);
    try {
      const [{ jsPDF }, html2canvasMod] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);
      const html2canvas = html2canvasMod.default;
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff" });
      const pdf = new jsPDF("l", "mm", "a4");
      const pageW = 297, pageH = 210, margin = 8;
      const maxW = pageW - margin * 2;
      const maxH = pageH - margin * 2;
      // Ajusta à largura; se ficar demasiado alto, encolhe para caber a altura.
      let imgW = maxW;
      let imgH = (canvas.height * imgW) / canvas.width;
      if (imgH > maxH) {
        imgH = maxH;
        imgW = (canvas.width * imgH) / canvas.height;
      }
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, margin, imgW, imgH);
      pdf.save(`performance-${filtroAno}-${String(filtroMes).padStart(2, "0")}.pdf`);
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setExporting(false);
    }
  }

  /* --------------------------- Modal: gerir segmentos --------------------------- */
  const [segOpen, setSegOpen] = useState(false);

  /* --------------------------- Modal: gerir indicadores --------------------------- */
  const [indOpen, setIndOpen] = useState(false);

  /* ---------------------------------- UI ---------------------------------- */
  const inputCell =
    "h-8 w-full min-w-0 rounded border border-input bg-background px-2 text-right text-sm tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  function ResultadoCell({ ind }: { ind: Indicador }) {
    const r = draft[ind.id];
    if (!r) return null;
    if (ind.tipo === "PREVISTO_REALIZADO") {
      return (
        <div className="flex items-center gap-1">
          <input
            type="number" step="0.01" placeholder="Prev."
            className={inputCell}
            value={r.resultado}
            onChange={(e) => setCampo(ind.id, "resultado", e.target.value)}
          />
          <span className="text-slate-400">/</span>
          <input
            type="number" step="0.01" placeholder="Real."
            className={inputCell}
            value={r.resultado2}
            onChange={(e) => setCampo(ind.id, "resultado2", e.target.value)}
          />
        </div>
      );
    }
    const suf =
      ind.unidade ||
      (ind.tipo === "PERCENTAGEM" ? "%" : ind.tipo === "HORAS" ? "h" : ind.tipo === "MOEDA" ? "Kz" : "");
    return (
      <div className="flex items-center gap-1">
        <input
          type="number" step="0.01"
          className={inputCell}
          value={r.resultado}
          onChange={(e) => setCampo(ind.id, "resultado", e.target.value)}
        />
        {suf && <span className="shrink-0 text-xs text-slate-400">{suf}</span>}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-navy">Indicadores de Performance</h1>
        <p className="text-sm text-muted-foreground">
          Quadro mensal (pedagógico) — valores de registo manual por ano/mês, com desagregação por segmentos.
        </p>
      </div>

      {/* Filtros + acções */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="w-36">
            <Label className="mb-1 block text-xs">Ano</Label>
            <select className={selectCls} value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)}>
              {anos.map((a) => (<option key={a} value={a}>{a}</option>))}
            </select>
          </div>
          <div className="w-40">
            <Label className="mb-1 block text-xs">Mês</Label>
            <select className={selectCls} value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)}>
              {MESES.map((m, idx) => (<option key={m} value={idx + 1}>{m}</option>))}
            </select>
          </div>
          <Button variant="navy" onClick={recarregar} disabled={loading}>Filtrar</Button>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setSegOpen(true)}>
              <Columns3 className="h-4 w-4" /> Segmentos
            </Button>
            <Button variant="outline" onClick={() => setIndOpen(true)}>
              <Settings2 className="h-4 w-4" /> Indicadores
            </Button>
            <Button variant="secondary" onClick={exportarPDF} disabled={exporting}>
              <FileDown className="h-4 w-4" /> {exporting ? "A gerar…" : "Exportar PDF"}
            </Button>
            <Button variant="navy" onClick={guardar} disabled={saving || loading}>
              <Save className="h-4 w-4" /> {saving ? "A guardar…" : "Guardar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading && indicadores.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">A carregar…</CardContent></Card>
      ) : indicadores.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Sem indicadores. Usa o botão <b>Indicadores</b> para criar o catálogo.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div ref={tableRef} className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="w-10 px-3 py-2 text-center">#</th>
                    <th className="px-3 py-2">Indicador</th>
                    <th className="w-44 px-3 py-2">Resultado</th>
                    {mostrarHoras && <th className="w-32 px-3 py-2">Horas</th>}
                    {segmentos.map((seg) => (
                      <th key={seg.id} className="w-28 px-3 py-2">{seg.nome}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {indicadores.map((ind, i) => {
                    const r = draft[ind.id];
                    return (
                      <tr key={ind.id} className="border-b last:border-0 hover:bg-slate-50/60">
                        <td className="px-3 py-1.5 text-center text-xs text-slate-400">{i + 1}</td>
                        <td className="px-3 py-1.5 font-medium text-navy">{ind.titulo}</td>
                        <td className="px-3 py-1.5"><ResultadoCell ind={ind} /></td>
                        {mostrarHoras && (
                          <td className="px-3 py-1.5">
                            {ind.usaHoras && r ? (
                              <div className="flex items-center gap-1">
                                <input
                                  type="number" step="0.01" placeholder="—"
                                  className={inputCell}
                                  value={r.horas}
                                  onChange={(e) => setCampo(ind.id, "horas", e.target.value)}
                                />
                                <span className="text-slate-400">/</span>
                                <input
                                  type="number" step="0.01" placeholder="—"
                                  className={inputCell}
                                  value={r.horasTotal}
                                  onChange={(e) => setCampo(ind.id, "horasTotal", e.target.value)}
                                />
                              </div>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        )}
                        {segmentos.map((seg) => (
                          <td key={seg.id} className="px-3 py-1.5">
                            {ind.usaSegmentos && r ? (
                              <input
                                type="number" step="0.01"
                                className={inputCell}
                                value={r.segmentos[seg.id] ?? ""}
                                onChange={(e) => setSeg(ind.id, seg.id, e.target.value)}
                              />
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <SegmentosModal open={segOpen} onOpenChange={setSegOpen} onChanged={recarregar} />
      <IndicadoresModal open={indOpen} onOpenChange={setIndOpen} onChanged={recarregar} />
    </div>
  );
}

/* ======================= Modal: gerir Segmentos ======================= */
function SegmentosModal({
  open, onOpenChange, onChanged,
}: { open: boolean; onOpenChange: (v: boolean) => void; onChanged: () => void }) {
  const [lista, setLista] = useState<Segmento[]>([]);
  const [nomes, setNomes] = useState<Record<string, string>>({});
  const [novo, setNovo] = useState("");
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState<Segmento | null>(null);

  const carregar = useCallback(async () => {
    try {
      const d = await api<{ segmentos: Segmento[] }>("/api/performance/segmentos");
      setLista(d.segmentos);
      setNomes(Object.fromEntries(d.segmentos.map((sg) => [sg.id, sg.nome])));
    } catch (e) {
      toast.error(msg(e));
    }
  }, []);

  useEffect(() => { if (open) carregar(); }, [open, carregar]);

  async function adicionar() {
    if (!novo.trim()) return;
    setBusy(true);
    try {
      await api("/api/performance/segmentos", { method: "POST", body: JSON.stringify({ nome: novo.trim() }) });
      setNovo("");
      await carregar();
      onChanged();
    } catch (e) { toast.error(msg(e)); } finally { setBusy(false); }
  }
  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      await api(`/api/performance/segmentos/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      await carregar();
      onChanged();
    } catch (e) { toast.error(msg(e)); } finally { setBusy(false); }
  }
  async function apagar() {
    if (!del) return;
    setBusy(true);
    try {
      await api(`/api/performance/segmentos/${del.id}`, { method: "DELETE" });
      setDel(null);
      await carregar();
      onChanged();
    } catch (e) { toast.error(msg(e)); } finally { setBusy(false); }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Gerir segmentos (colunas)</DialogTitle></DialogHeader>
          <p className="mb-2 text-xs text-muted-foreground">
            Lista própria do módulo de Performance — não usa os clientes dos Cadastros.
          </p>
          <div className="space-y-2">
            {lista.map((sg) => (
              <div key={sg.id} className="flex items-center gap-2">
                <Input
                  value={nomes[sg.id] ?? ""}
                  onChange={(e) => setNomes({ ...nomes, [sg.id]: e.target.value })}
                  onBlur={() => {
                    const nv = (nomes[sg.id] ?? "").trim();
                    if (nv && nv !== sg.nome) patch(sg.id, { nome: nv });
                  }}
                />
                <label className="flex shrink-0 items-center gap-1 text-xs text-slate-600">
                  <input
                    type="checkbox"
                    checked={sg.ativo}
                    onChange={(e) => patch(sg.id, { ativo: e.target.checked })}
                  />
                  Activo
                </label>
                <Button variant="ghost" size="icon" onClick={() => setDel(sg)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2 border-t pt-3">
            <Input placeholder="Novo segmento" value={novo} onChange={(e) => setNovo(e.target.value)} />
            <Button variant="outline" onClick={adicionar} disabled={busy || !novo.trim()}>
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {del && (
        <ConfirmDialog
          title="Remover segmento"
          danger
          busy={busy}
          confirmLabel="Remover"
          message={<>Remover a coluna <b>{del.nome}</b>? Os valores lançados nesta coluna serão apagados.</>}
          onConfirm={apagar}
          onCancel={() => setDel(null)}
        />
      )}
    </>
  );
}

/* ======================= Modal: gerir Indicadores ======================= */
function IndicadoresModal({
  open, onOpenChange, onChanged,
}: { open: boolean; onOpenChange: (v: boolean) => void; onChanged: () => void }) {
  const [lista, setLista] = useState<Indicador[]>([]);
  const [busy, setBusy] = useState(false);
  const [del, setDel] = useState<Indicador | null>(null);
  const [novo, setNovo] = useState<{ titulo: string; tipo: Tipo; usaHoras: boolean; usaSegmentos: boolean; unidade: string }>(
    { titulo: "", tipo: "NUMERO", usaHoras: false, usaSegmentos: true, unidade: "" }
  );

  const carregar = useCallback(async () => {
    try {
      const d = await api<{ indicadores: Indicador[] }>("/api/performance/indicadores");
      setLista(d.indicadores);
    } catch (e) { toast.error(msg(e)); }
  }, []);

  useEffect(() => { if (open) carregar(); }, [open, carregar]);

  async function adicionar() {
    if (!novo.titulo.trim()) return toast.error("O título é obrigatório");
    setBusy(true);
    try {
      await api("/api/performance/indicadores", { method: "POST", body: JSON.stringify(novo) });
      setNovo({ titulo: "", tipo: "NUMERO", usaHoras: false, usaSegmentos: true, unidade: "" });
      await carregar();
      onChanged();
    } catch (e) { toast.error(msg(e)); } finally { setBusy(false); }
  }
  async function patch(id: string, body: Record<string, unknown>) {
    setBusy(true);
    try {
      await api(`/api/performance/indicadores/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      await carregar();
      onChanged();
    } catch (e) { toast.error(msg(e)); } finally { setBusy(false); }
  }
  async function apagar() {
    if (!del) return;
    setBusy(true);
    try {
      await api(`/api/performance/indicadores/${del.id}`, { method: "DELETE" });
      setDel(null);
      await carregar();
      onChanged();
    } catch (e) { toast.error(msg(e)); } finally { setBusy(false); }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Gerir indicadores</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {lista.map((ind) => (
              <div key={ind.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-2">
                <Input
                  className="min-w-[200px] flex-1"
                  defaultValue={ind.titulo}
                  onBlur={(e) => {
                    const nv = e.target.value.trim();
                    if (nv && nv !== ind.titulo) patch(ind.id, { titulo: nv });
                  }}
                />
                <select
                  className={selectCls + " w-auto"}
                  value={ind.tipo}
                  onChange={(e) => patch(ind.id, { tipo: e.target.value })}
                >
                  {TIPOS.map((t) => (<option key={t} value={t}>{TIPO_LABELS[t]}</option>))}
                </select>
                <label className="flex items-center gap-1 text-xs text-slate-600">
                  <input type="checkbox" checked={ind.usaHoras} onChange={(e) => patch(ind.id, { usaHoras: e.target.checked })} />
                  Horas
                </label>
                <label className="flex items-center gap-1 text-xs text-slate-600">
                  <input type="checkbox" checked={ind.usaSegmentos} onChange={(e) => patch(ind.id, { usaSegmentos: e.target.checked })} />
                  Segmentos
                </label>
                <label className="flex items-center gap-1 text-xs text-slate-600">
                  <input type="checkbox" checked={ind.ativo} onChange={(e) => patch(ind.id, { ativo: e.target.checked })} />
                  Activo
                </label>
                <Button variant="ghost" size="icon" onClick={() => setDel(ind)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-2 rounded-lg border-2 border-dashed p-3">
            <Label className="text-xs font-semibold">Novo indicador</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="min-w-[200px] flex-1"
                placeholder="Título"
                value={novo.titulo}
                onChange={(e) => setNovo({ ...novo, titulo: e.target.value })}
              />
              <select
                className={selectCls + " w-auto"}
                value={novo.tipo}
                onChange={(e) => setNovo({ ...novo, tipo: e.target.value as Tipo })}
              >
                {TIPOS.map((t) => (<option key={t} value={t}>{TIPO_LABELS[t]}</option>))}
              </select>
              <Input
                className="w-24"
                placeholder="Unidade"
                value={novo.unidade}
                onChange={(e) => setNovo({ ...novo, unidade: e.target.value })}
              />
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <input type="checkbox" checked={novo.usaHoras} onChange={(e) => setNovo({ ...novo, usaHoras: e.target.checked })} />
                Horas
              </label>
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <input type="checkbox" checked={novo.usaSegmentos} onChange={(e) => setNovo({ ...novo, usaSegmentos: e.target.checked })} />
                Segmentos
              </label>
              <Button variant="outline" onClick={adicionar} disabled={busy || !novo.titulo.trim()}>
                <Plus className="h-4 w-4" /> Adicionar
              </Button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {del && (
        <ConfirmDialog
          title="Remover indicador"
          danger
          busy={busy}
          confirmLabel="Remover"
          message={<>Remover o indicador <b>{del.titulo}</b>? Todos os valores lançados serão apagados.</>}
          onConfirm={apagar}
          onCancel={() => setDel(null)}
        />
      )}
    </>
  );
}
