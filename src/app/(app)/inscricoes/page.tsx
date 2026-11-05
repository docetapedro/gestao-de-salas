"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  CalendarDays,
  Check,
  Copy,
  Download,
  MapPin,
  Pencil,
  Plus,
  QrCode as QrCodeIcon,
  Trash2,
  Users,
} from "lucide-react";
import QRCodeLib from "qrcode";
import { api } from "@/lib/api";
import { TIPOS_EVENTO } from "@/lib/inscricoes";
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

const msg = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado");
const inputCls =
  "h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Evento = {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  local: string | null;
  dataInicio: string | null;
  slug: string;
  ativo: boolean;
  _count: { inscricoes: number };
};

type FormState = {
  tipo: string;
  titulo: string;
  descricao: string;
  local: string;
  dataInicio: string;
};

const VAZIO: FormState = {
  tipo: "Workshop",
  titulo: "",
  descricao: "",
  local: "",
  dataInicio: "",
};

function fmtDataHora(iso: string | null): string {
  if (!iso) return "Sem data definida";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Sem data definida";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

// ISO → "YYYY-MM-DDTHH:mm" para o input datetime-local (hora local).
function toInputDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function EventosInscricaoPage() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);

  // Criar/editar
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(VAZIO);
  const [saving, setSaving] = useState(false);

  // Eliminar
  const [del, setDel] = useState<Evento | null>(null);
  const [busyDel, setBusyDel] = useState(false);

  // QR / link
  const [qrEvento, setQrEvento] = useState<Evento | null>(null);
  const [qr, setQr] = useState("");
  const [copiado, setCopiado] = useState(false);

  const origem = typeof window !== "undefined" ? window.location.origin : "";
  const linkDe = (ev: Evento) => `${origem}/inscricao/${ev.slug}`;

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { eventos } = await api<{ eventos: Evento[] }>("/api/inscricoes/eventos");
      setEventos(eventos);
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Gera o QR quando um evento é selecionado.
  useEffect(() => {
    if (!qrEvento) return;
    QRCodeLib.toDataURL(linkDe(qrEvento), { width: 1024, margin: 1 })
      .then(setQr)
      .catch(() => setQr(""));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrEvento]);

  function abrirNovo() {
    setEditId(null);
    setForm(VAZIO);
    setOpen(true);
  }

  function abrirEditar(ev: Evento) {
    setEditId(ev.id);
    setForm({
      tipo: ev.tipo,
      titulo: ev.titulo,
      descricao: ev.descricao || "",
      local: ev.local || "",
      dataInicio: toInputDateTime(ev.dataInicio),
    });
    setOpen(true);
  }

  async function salvar() {
    if (!form.titulo.trim()) {
      toast.error("O nome do evento é obrigatório.");
      return;
    }
    setSaving(true);
    try {
      if (editId) {
        await api(`/api/inscricoes/eventos/${editId}`, {
          method: "PATCH",
          body: JSON.stringify(form),
        });
        toast.success("Evento actualizado");
      } else {
        await api("/api/inscricoes/eventos", {
          method: "POST",
          body: JSON.stringify(form),
        });
        toast.success("Evento criado");
      }
      setOpen(false);
      carregar();
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setSaving(false);
    }
  }

  async function toggleAtivo(ev: Evento) {
    try {
      await api(`/api/inscricoes/eventos/${ev.id}`, {
        method: "PATCH",
        body: JSON.stringify({ ativo: !ev.ativo }),
      });
      setEventos((prev) =>
        prev.map((e) => (e.id === ev.id ? { ...e, ativo: !ev.ativo } : e))
      );
    } catch (e) {
      toast.error(msg(e));
    }
  }

  async function excluir() {
    if (!del) return;
    setBusyDel(true);
    try {
      await api(`/api/inscricoes/eventos/${del.id}`, { method: "DELETE" });
      toast.success("Evento removido");
      setDel(null);
      carregar();
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setBusyDel(false);
    }
  }

  function copiarLink() {
    if (!qrEvento) return;
    navigator.clipboard?.writeText(linkDe(qrEvento)).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    });
  }

  function descarregarQr() {
    if (!qr || !qrEvento) return;
    const a = document.createElement("a");
    a.href = qr;
    a.download = `qr-${qrEvento.slug}.png`;
    a.click();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Eventos de Inscrição</h1>
          <p className="text-sm text-slate-500">
            Crie workshops, palestras e formações. Cada evento gera um link único e
            um QR Code para partilhar.
          </p>
        </div>
        <Button variant="navy" onClick={abrirNovo} className="gap-2">
          <Plus className="h-4 w-4" />
          Novo evento
        </Button>
      </div>

      {loading ? (
        <p className="p-6 text-sm text-slate-500">A carregar…</p>
      ) : eventos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
            <CalendarDays className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-500">
              Ainda não há eventos. Clique em <b>Novo evento</b> para criar o primeiro.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {eventos.map((ev) => (
            <Card key={ev.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
                    {ev.tipo}
                  </span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      ev.ativo
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    {ev.ativo ? "Inscrições abertas" : "Encerrado"}
                  </span>
                </div>

                <div>
                  <h2 className="font-semibold leading-tight text-navy">{ev.titulo}</h2>
                  <div className="mt-1.5 space-y-1 text-xs text-slate-500">
                    <p className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {fmtDataHora(ev.dataInicio)}
                    </p>
                    {ev.local && (
                      <p className="flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5" />
                        {ev.local}
                      </p>
                    )}
                    <p className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {ev._count.inscricoes}{" "}
                      {ev._count.inscricoes === 1 ? "inscrito" : "inscritos"}
                    </p>
                  </div>
                </div>

                <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1">
                  <Button asChild size="sm" variant="outline" className="gap-1.5">
                    <Link href={`/inscricoes/${ev.id}`}>
                      <Users className="h-3.5 w-3.5" />
                      Ver inscritos
                    </Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setQrEvento(ev)}
                  >
                    <QrCodeIcon className="h-3.5 w-3.5" />
                    QR / Link
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs"
                    onClick={() => toggleAtivo(ev)}
                    title={ev.ativo ? "Encerrar inscrições" : "Reabrir inscrições"}
                  >
                    {ev.ativo ? "Encerrar" : "Reabrir"}
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => abrirEditar(ev)}
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDel(ev)}
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Criar / editar evento */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] w-[95vw] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Editar evento" : "Novo evento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block text-xs">Tipo</Label>
                <input
                  list="tipos-evento"
                  className={inputCls}
                  value={form.tipo}
                  onChange={(e) => setForm({ ...form, tipo: e.target.value })}
                  placeholder="Workshop"
                />
                <datalist id="tipos-evento">
                  {TIPOS_EVENTO.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
              <div>
                <Label className="mb-1 block text-xs">Data e hora</Label>
                <input
                  type="datetime-local"
                  className={inputCls}
                  value={form.dataInicio}
                  onChange={(e) => setForm({ ...form, dataInicio: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="mb-1 block text-xs">Nome do evento</Label>
              <Input
                value={form.titulo}
                onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                placeholder="Inteligência Artificial no Mundo Corporativo"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Local</Label>
              <Input
                value={form.local}
                onChange={(e) => setForm({ ...form, local: e.target.value })}
                placeholder="Auditório, sala, link online…"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs">Descrição (opcional)</Label>
              <textarea
                className="min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Breve descrição mostrada no formulário público."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Fechar
            </Button>
            <Button variant="navy" onClick={salvar} disabled={saving}>
              {saving ? "A guardar…" : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code + link */}
      <Dialog open={!!qrEvento} onOpenChange={(v) => !v && setQrEvento(null)}>
        <DialogContent className="w-[95vw] max-w-md">
          <DialogHeader>
            <DialogTitle>QR Code & link</DialogTitle>
          </DialogHeader>
          {qrEvento && (
            <div className="flex flex-col items-center gap-3">
              <p className="text-center text-sm font-semibold text-navy">
                {qrEvento.titulo}
              </p>
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={qr}
                  alt="QR Code de inscrição"
                  className="h-52 w-52 rounded-xl border border-slate-200"
                />
              ) : (
                <div className="flex h-52 w-52 items-center justify-center rounded-xl border border-slate-200 text-slate-300">
                  <QrCodeIcon className="h-10 w-10" />
                </div>
              )}
              <p className="text-center text-xs text-slate-500">
                Imprima, projete ou partilhe. Ao digitalizar, os participantes abrem o
                formulário e inscrevem-se — sem login.
              </p>
              <div className="flex w-full items-center gap-2">
                <input
                  readOnly
                  value={linkDe(qrEvento)}
                  className="h-9 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs text-slate-600 outline-none"
                />
                <Button size="sm" variant="outline" onClick={copiarLink} title="Copiar link">
                  {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <Button
                size="sm"
                variant="navy"
                className="w-full gap-2"
                onClick={descarregarQr}
                disabled={!qr}
              >
                <Download className="h-4 w-4" />
                Descarregar PNG
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {del && (
        <ConfirmDialog
          title="Eliminar evento"
          danger
          busy={busyDel}
          confirmLabel="Eliminar"
          message={
            <>
              Eliminar <b>{del.titulo}</b> e as suas {del._count.inscricoes} inscrições?
              Esta acção não pode ser anulada.
            </>
          }
          onConfirm={excluir}
          onCancel={() => setDel(null)}
        />
      )}
    </div>
  );
}
