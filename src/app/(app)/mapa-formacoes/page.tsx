"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileDown, Pencil, Plus, Trash2 } from "lucide-react";
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
import DatePicker from "@/components/DatePicker";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const MESES_ABR = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const msg = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado");
const selectCls =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Formacao = {
  id: string;
  cliente: string;
  accao: string;
  tipoActividade: string;
  dataInicio: string | null;
  dataFim: string | null;
  previstos: number | null;
  presentes: number | null;
  concluiram: number | null;
  cargaHoraria: number | null;
};

type FormState = {
  cliente: string;
  accao: string;
  tipoActividade: string;
  dataInicio: string;
  dataFim: string;
  previstos: string;
  presentes: string;
  concluiram: string;
  cargaHoraria: string;
};

const VAZIO: FormState = {
  cliente: "",
  accao: "",
  tipoActividade: "Formação",
  dataInicio: "",
  dataFim: "",
  previstos: "",
  presentes: "",
  concluiram: "",
  cargaHoraria: "",
};

const n = (v: number | null) => (v === null || v === undefined ? "" : String(v));
const toInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
function fmtData(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MESES_ABR[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function anosDisponiveis(): number[] {
  const atual = new Date().getFullYear();
  const fim = Math.max(2026, atual);
  const out: number[] = [];
  for (let a = 2026; a <= fim; a++) out.push(a);
  return out;
}

export default function MapaFormacoesPage() {
  const anos = useMemo(anosDisponiveis, []);
  const [filtroAno, setFiltroAno] = useState(() => String(new Date().getFullYear()));
  const [filtroMes, setFiltroMes] = useState("");
  const [q, setQ] = useState("");

  const [dados, setDados] = useState<Formacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const carregar = useCallback(async (ano: string, mes: string, busca: string) => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (ano) qs.set("ano", ano);
      if (mes) qs.set("mes", mes);
      if (busca.trim()) qs.set("q", busca.trim());
      const d = await api<{ formacoes: Formacao[] }>(`/api/mapa-formacoes?${qs}`);
      setDados(d.formacoes);
    } catch (e) {
      setError(msg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar(filtroAno, filtroMes, q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [carregar]);

  const recarregar = () => carregar(filtroAno, filtroMes, q);

  /* ------------------------------ Modal criar/editar ------------------------------ */
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(VAZIO);
  const [saving, setSaving] = useState(false);

  function abrirNovo() {
    setEditId(null);
    setForm(VAZIO);
    setOpen(true);
  }
  function abrirEditar(f: Formacao) {
    setEditId(f.id);
    setForm({
      cliente: f.cliente,
      accao: f.accao,
      tipoActividade: f.tipoActividade || "Formação",
      dataInicio: toInput(f.dataInicio),
      dataFim: toInput(f.dataFim),
      previstos: n(f.previstos),
      presentes: n(f.presentes),
      concluiram: n(f.concluiram),
      cargaHoraria: n(f.cargaHoraria),
    });
    setOpen(true);
  }

  async function salvar() {
    if (!form.cliente.trim()) return toast.error("O cliente é obrigatório");
    if (!form.accao.trim()) return toast.error("A acção é obrigatória");
    setSaving(true);
    try {
      const payload = { ...form };
      if (editId) {
        await api(`/api/mapa-formacoes/${editId}`, { method: "PATCH", body: JSON.stringify(payload) });
        toast.success("Formação actualizada");
      } else {
        await api("/api/mapa-formacoes", { method: "POST", body: JSON.stringify(payload) });
        toast.success("Formação adicionada");
      }
      setOpen(false);
      recarregar();
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setSaving(false);
    }
  }

  /* --------------------------------- Excluir --------------------------------- */
  const [del, setDel] = useState<Formacao | null>(null);
  const [busyDel, setBusyDel] = useState(false);
  async function excluir() {
    if (!del) return;
    setBusyDel(true);
    try {
      await api(`/api/mapa-formacoes/${del.id}`, { method: "DELETE" });
      toast.success("Formação removida");
      setDel(null);
      recarregar();
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setBusyDel(false);
    }
  }

  /* -------------------------------- Export PDF -------------------------------- */
  const [exporting, setExporting] = useState(false);
  async function exportarPDF() {
    const el = tableRef.current;
    if (!el) return;
    if (dados.length === 0) return toast.error("Nada para exportar");
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
      let imgW = maxW;
      let imgH = (canvas.height * imgW) / canvas.width;
      if (imgH > maxH) {
        imgH = maxH;
        imgW = (canvas.width * imgH) / canvas.height;
      }
      pdf.addImage(canvas.toDataURL("image/png"), "PNG", margin, margin, imgW, imgH);
      pdf.save("mapa-formacoes.pdf");
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setExporting(false);
    }
  }

  const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500";
  const td = "px-3 py-2 align-top";

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-navy">Mapa de Formações</h1>
        <p className="text-sm text-muted-foreground">
          Registo das formações realizadas — cliente, acção, datas, formandos e carga horária.
        </p>
      </div>

      {/* Filtros + acções */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="w-32">
            <Label className="mb-1 block text-xs">Ano</Label>
            <select className={selectCls} value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)}>
              <option value="">Todos</option>
              {anos.map((a) => (<option key={a} value={a}>{a}</option>))}
            </select>
          </div>
          <div className="w-40">
            <Label className="mb-1 block text-xs">Mês</Label>
            <select className={selectCls} value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)}>
              <option value="">Todos os meses</option>
              {MESES.map((m, idx) => (<option key={m} value={idx + 1}>{m}</option>))}
            </select>
          </div>
          <div className="w-56">
            <Label className="mb-1 block text-xs">Pesquisar</Label>
            <Input
              placeholder="Cliente ou acção…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && recarregar()}
            />
          </div>
          <Button variant="navy" onClick={recarregar} disabled={loading}>Filtrar</Button>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button variant="outline" onClick={abrirNovo}>
              <Plus className="h-4 w-4" /> Nova formação
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
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">A carregar…</CardContent></Card>
      ) : dados.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Sem formações no período. Usa <b>Nova formação</b> para registar.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div ref={tableRef} className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className={th}>Cliente</th>
                    <th className={th}>Acção</th>
                    <th className={th}>Data início</th>
                    <th className={th}>Data fim</th>
                    <th className={th}>Tipo</th>
                    <th className={th + " text-right"}>Previstos</th>
                    <th className={th + " text-right"}>Presentes</th>
                    <th className={th + " text-right"}>Concluíram</th>
                    <th className={th + " text-right"}>Carga horária</th>
                    <th className={th + " text-right"} data-noexport>Acções</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.map((f) => (
                    <tr key={f.id} className="border-b last:border-0 hover:bg-slate-50/60">
                      <td className={td + " font-medium text-navy"}>{f.cliente}</td>
                      <td className={td + " font-medium"}>{f.accao}</td>
                      <td className={td + " whitespace-nowrap text-slate-600"}>{fmtData(f.dataInicio)}</td>
                      <td className={td + " whitespace-nowrap text-slate-600"}>{fmtData(f.dataFim)}</td>
                      <td className={td + " text-slate-600"}>{f.tipoActividade}</td>
                      <td className={td + " text-right tabular-nums"}>{n(f.previstos) || "—"}</td>
                      <td className={td + " text-right tabular-nums"}>{n(f.presentes) || "—"}</td>
                      <td className={td + " text-right tabular-nums"}>{n(f.concluiram) || "—"}</td>
                      <td className={td + " text-right tabular-nums"}>{n(f.cargaHoraria) || "—"}</td>
                      <td className={td + " text-right"} data-noexport>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => abrirEditar(f)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDel(f)} title="Remover">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* --------------------------- Modal criar/editar --------------------------- */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar formação" : "Nova formação"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-xs">Cliente</Label>
                <Input value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} placeholder="Giant, AGT 4.0, Interno…" />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Tipo de actividade</Label>
                <Input value={form.tipoActividade} onChange={(e) => setForm({ ...form, tipoActividade: e.target.value })} />
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Acção</Label>
              <Input value={form.accao} onChange={(e) => setForm({ ...form, accao: e.target.value })} placeholder="Nome da formação" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-xs">Data início</Label>
                <DatePicker
                  className={selectCls}
                  value={form.dataInicio}
                  onChange={(v) => setForm({ ...form, dataInicio: v })}
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Data fim</Label>
                <DatePicker
                  className={selectCls}
                  value={form.dataFim}
                  onChange={(v) => setForm({ ...form, dataFim: v })}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="mb-1 block text-xs">Previstos</Label>
                <Input type="number" min="0" value={form.previstos} onChange={(e) => setForm({ ...form, previstos: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Presentes</Label>
                <Input type="number" min="0" value={form.presentes} onChange={(e) => setForm({ ...form, presentes: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Concluíram</Label>
                <Input type="number" min="0" value={form.concluiram} onChange={(e) => setForm({ ...form, concluiram: e.target.value })} />
              </div>
            </div>
            <div className="w-1/3 pr-1.5">
              <Label className="mb-1 block text-xs">Carga horária</Label>
              <Input type="number" min="0" step="0.5" value={form.cargaHoraria} onChange={(e) => setForm({ ...form, cargaHoraria: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button>
            <Button variant="navy" onClick={salvar} disabled={saving}>
              {saving ? "A guardar…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {del && (
        <ConfirmDialog
          title="Remover formação"
          danger
          busy={busyDel}
          confirmLabel="Remover"
          message={<>Remover a formação <b>{del.accao}</b> de <b>{del.cliente}</b>?</>}
          onConfirm={excluir}
          onCancel={() => setDel(null)}
        />
      )}
    </div>
  );
}
