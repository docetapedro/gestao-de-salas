"use client";

import { useCallback, useEffect, useState } from "react";
import DatePicker, { registerLocale } from "react-datepicker";
import { ptBR } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { ChevronLeft, ChevronRight, Pencil, Plus, Repeat, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Modal, ConfirmDialog } from "@/components/Modal";

registerLocale("pt-BR", ptBR);

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Limites de hora do seletor (horário de trabalho 08h–18h).
function workMin() {
  const d = new Date();
  d.setHours(8, 0, 0, 0);
  return d;
}
function workMax() {
  const d = new Date();
  d.setHours(18, 0, 0, 0);
  return d;
}

type Room = { id: string; name: string; active: boolean };
type EventItem = {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  room: { id: string; name: string; color: string };
  createdBy: { id: string; name: string } | null;
  seriesId: string | null;
};

const PAGE_SIZE = 10;

// Classe para os campos DatePicker (mantém aparência de Input do shadcn).
const dpInput =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1";

const emptyForm = () => {
  const now = new Date();
  now.setMinutes(0, 0, 0);
  if (now.getHours() < 8) now.setHours(8);
  if (now.getHours() >= 18) now.setHours(17);
  const later = new Date(now.getTime() + 60 * 60000);
  return {
    id: "",
    title: "",
    description: "",
    roomId: "",
    startAt: now as Date,
    endAt: later as Date,
    repeat: "none" as "none" | "daily" | "weekly" | "monthly",
    repeatUntil: null as Date | null,
  };
};

function statusOf(ev: EventItem): {
  label: string;
  variant: "secondary" | "destructive" | "success";
} {
  const n = Date.now();
  const s = new Date(ev.startAt).getTime();
  const e = new Date(ev.endAt).getTime();
  if (e < n) return { label: "Encerrado", variant: "secondary" };
  if (s <= n) return { label: "Em curso", variant: "destructive" };
  return { label: "Agendado", variant: "success" };
}

export default function EventosPage() {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canManage, setCanManage] = useState(false);

  // Filtros
  const [fRoom, setFRoom] = useState("");
  const [fFrom, setFFrom] = useState<Date | null>(null);
  const [fTo, setFTo] = useState<Date | null>(null);

  // Formulário
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Confirmações de exclusão
  const [confirmDelete, setConfirmDelete] = useState<EventItem | null>(null);
  const [confirmDeleteSeries, setConfirmDeleteSeries] =
    useState<EventItem | null>(null);
  const [removing, setRemoving] = useState(false);

  // Carrega salas + permissão uma vez.
  useEffect(() => {
    (async () => {
      try {
        const [r, me] = await Promise.all([
          api<{ rooms: Room[] }>("/api/rooms"),
          api<{ user: { role: string } }>("/api/auth/me"),
        ]);
        setRooms(r.rooms.filter((x) => x.active));
        setCanManage(["ADMIN", "MANAGER"].includes(me.user.role));
      } catch (err) {
        setError((err as Error).message);
      }
    })();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({
        page: String(page),
        pageSize: String(PAGE_SIZE),
      });
      if (fRoom) qs.set("roomId", fRoom);
      if (fFrom) qs.set("from", `${ymd(fFrom)}T00:00:00`);
      if (fTo) qs.set("to", `${ymd(fTo)}T23:59:59`);

      const data = await api<{ events: EventItem[]; total: number }>(
        `/api/events?${qs.toString()}`
      );
      // Se a página ficou vazia (ex.: após excluir), recua uma página.
      if (data.events.length === 0 && page > 1) {
        setPage((p) => p - 1);
        return;
      }
      setEvents(data.events);
      setTotal(data.total);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [page, fRoom, fFrom, fTo]);

  useEffect(() => {
    load();
  }, [load]);

  function clearFilters() {
    setFRoom("");
    setFFrom(null);
    setFTo(null);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const fromIdx = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const toIdx = Math.min(total, page * PAGE_SIZE);
  const hasFilters = fRoom || fFrom || fTo;

  function openCreate() {
    const f = emptyForm();
    if (rooms[0]) f.roomId = rooms[0].id;
    setForm(f);
    setShowForm(true);
    setError(null);
  }
  function openEdit(ev: EventItem) {
    setForm({
      id: ev.id,
      title: ev.title,
      description: ev.description || "",
      roomId: ev.room.id,
      startAt: new Date(ev.startAt),
      endAt: new Date(ev.endAt),
      repeat: "none",
      repeatUntil: null,
    });
    setShowForm(true);
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.id && form.repeat !== "none" && !form.repeatUntil) {
      setError("Informe a data limite da repetição");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (form.id) {
        await api(`/api/events/${form.id}`, {
          method: "PUT",
          body: JSON.stringify({
            title: form.title,
            description: form.description || null,
            roomId: form.roomId,
            startAt: form.startAt.toISOString(),
            endAt: form.endAt.toISOString(),
          }),
        });
        setShowForm(false);
        await load();
      } else {
        const res = await api<{ created?: number; skipped?: number }>(
          "/api/events",
          {
            method: "POST",
            body: JSON.stringify({
              title: form.title,
              description: form.description || null,
              roomId: form.roomId,
              startAt: form.startAt.toISOString(),
              endAt: form.endAt.toISOString(),
              repeat: form.repeat,
              repeatUntil: form.repeatUntil
                ? form.repeatUntil.toISOString()
                : null,
            }),
          }
        );
        setShowForm(false);
        await load();
        if (form.repeat !== "none" && res.created !== undefined) {
          toast.success(
            `Série criada: ${res.created} evento(s).` +
              (res.skipped ? ` ${res.skipped} ignorado(s) por conflito.` : "")
          );
        }
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(ev: EventItem) {
    setRemoving(true);
    try {
      await api(`/api/events/${ev.id}`, { method: "DELETE" });
      setConfirmDelete(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRemoving(false);
    }
  }

  async function removeSeries(ev: EventItem) {
    setRemoving(true);
    try {
      const r = await api<{ deleted: number }>(
        `/api/events/${ev.id}?series=1`,
        { method: "DELETE" }
      );
      setConfirmDeleteSeries(null);
      await load();
      toast.success(`Série removida: ${r.deleted} ocorrência(s).`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRemoving(false);
    }
  }

  function fmt(s: string) {
    return new Date(s).toLocaleString("pt-PT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-navy">Eventos</h1>
        {canManage && (
          <Button
            variant="navy"
            onClick={openCreate}
            disabled={rooms.length === 0}
          >
            <Plus className="h-4 w-4" />
            Novo evento
          </Button>
        )}
      </div>

      {/* Barra de filtros */}
      <Card className="p-3 mb-4 flex flex-wrap items-end gap-3">
        <div>
          <Label className="mb-1 block text-xs text-slate-500">Sala</Label>
          <Select
            value={fRoom || "all"}
            onValueChange={(v) => {
              setFRoom(v === "all" ? "" : v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todas as salas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as salas</SelectItem>
              {rooms.map((r) => (
                <SelectItem key={r.id} value={r.id}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="mb-1 block text-xs text-slate-500">De</Label>
          <DatePicker
            selected={fFrom}
            onChange={(d: Date | null) => {
              setFFrom(d);
              setPage(1);
            }}
            selectsStart
            startDate={fFrom}
            endDate={fTo}
            dateFormat="dd/MM/yyyy"
            locale="pt-BR"
            isClearable
            placeholderText="dd/mm/aaaa"
            className={cn(dpInput, "w-36")}
          />
        </div>
        <div>
          <Label className="mb-1 block text-xs text-slate-500">Até</Label>
          <DatePicker
            selected={fTo}
            onChange={(d: Date | null) => {
              setFTo(d);
              setPage(1);
            }}
            selectsEnd
            startDate={fFrom}
            endDate={fTo}
            minDate={fFrom ?? undefined}
            dateFormat="dd/MM/yyyy"
            locale="pt-BR"
            isClearable
            placeholderText="dd/mm/aaaa"
            className={cn(dpInput, "w-36")}
          />
        </div>
        {hasFilters && (
          <Button variant="outline" onClick={clearFilters}>
            Limpar filtros
          </Button>
        )}
        <div className="ml-auto self-center text-sm text-slate-500">
          {total} evento{total === 1 ? "" : "s"}
        </div>
      </Card>

      {error && !showForm && (
        <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <Card className="overflow-hidden p-0">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Carregando…</div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            Nenhum evento encontrado{hasFilters ? " com esses filtros" : ""}.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Evento</TableHead>
                <TableHead>Sala</TableHead>
                <TableHead>Início</TableHead>
                <TableHead>Fim</TableHead>
                <TableHead>Status</TableHead>
                {canManage && <TableHead className="text-right">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((ev) => {
                const st = statusOf(ev);
                return (
                  <TableRow key={ev.id}>
                    <TableCell className="font-medium text-slate-800">
                      {ev.title}
                      {ev.seriesId && (
                        <Badge
                          variant="secondary"
                          className="ml-2 gap-1 bg-brand-100 text-brand-700 align-middle"
                          title="Faz parte de uma série recorrente"
                        >
                          <Repeat className="h-3 w-3" />
                          série
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2 text-slate-600">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: ev.room.color }}
                        />
                        {ev.room.name}
                      </span>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {fmt(ev.startAt)}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {fmt(ev.endAt)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={st.variant}>{st.label}</Badge>
                    </TableCell>
                    {canManage && (
                      <TableCell className="whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEdit(ev)}
                          >
                            <Pencil className="h-4 w-4" />
                            Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={() => setConfirmDelete(ev)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Excluir
                          </Button>
                          {ev.seriesId && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="font-medium text-red-700 hover:text-red-800"
                              onClick={() => setConfirmDeleteSeries(ev)}
                            >
                              Excluir série
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {/* Paginação */}
        {total > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
            <span className="text-slate-500">
              Mostrando {fromIdx}–{toIdx} de {total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </Button>
              <span className="text-slate-600">
                Página {page} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Próximo
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Modal de criar/editar */}
      {showForm && (
        <Modal
          title={form.id ? "Editar evento" : "Novo evento"}
          onClose={() => setShowForm(false)}
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                form="evento-form"
                variant="navy"
                disabled={saving}
              >
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            </>
          }
        >
          <form id="evento-form" onSubmit={save} className="space-y-3">
            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </div>
            )}
            <div>
              <Label className="mb-1 block">Título *</Label>
              <Input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </div>
            <div>
              <Label className="mb-1 block">Sala *</Label>
              <Select
                value={form.roomId}
                onValueChange={(v) => setForm({ ...form, roomId: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione…" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <Label className="mb-1 block">Início *</Label>
                <DatePicker
                  selected={form.startAt}
                  onChange={(d: Date | null) => {
                    if (!d) return;
                    // Mantém o fim depois do início (ajusta se necessário).
                    const end =
                      form.endAt <= d
                        ? new Date(d.getTime() + 60 * 60000)
                        : form.endAt;
                    setForm({ ...form, startAt: d, endAt: end });
                  }}
                  showTimeSelect
                  timeIntervals={15}
                  timeCaption="Hora"
                  minTime={workMin()}
                  maxTime={workMax()}
                  dateFormat="dd/MM/yyyy HH:mm"
                  locale="pt-BR"
                  className={dpInput}
                  wrapperClassName="w-full"
                />
              </div>
              <div className="flex-1">
                <Label className="mb-1 block">Fim *</Label>
                <DatePicker
                  selected={form.endAt}
                  onChange={(d: Date | null) => d && setForm({ ...form, endAt: d })}
                  showTimeSelect
                  timeIntervals={15}
                  timeCaption="Hora"
                  minDate={form.startAt}
                  minTime={workMin()}
                  maxTime={workMax()}
                  dateFormat="dd/MM/yyyy HH:mm"
                  locale="pt-BR"
                  className={dpInput}
                  wrapperClassName="w-full"
                />
              </div>
            </div>
            <div>
              <Label className="mb-1 block">Descrição</Label>
              <Textarea
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
              />
            </div>
            {!form.id && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <Label className="mb-1 block">Repetir</Label>
                  <Select
                    value={form.repeat}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        repeat: v as typeof form.repeat,
                        repeatUntil: v === "none" ? null : form.repeatUntil,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Não repete</SelectItem>
                      <SelectItem value="daily">
                        Diariamente (seg–sáb)
                      </SelectItem>
                      <SelectItem value="weekly">Semanalmente</SelectItem>
                      <SelectItem value="monthly">Mensalmente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {form.repeat !== "none" && (
                  <div className="flex-1">
                    <Label className="mb-1 block">Repetir até *</Label>
                    <DatePicker
                      selected={form.repeatUntil}
                      onChange={(d: Date | null) =>
                        setForm({ ...form, repeatUntil: d })
                      }
                      dateFormat="dd/MM/yyyy"
                      locale="pt-BR"
                      minDate={form.startAt}
                      placeholderText="dd/mm/aaaa"
                      className={dpInput}
                      wrapperClassName="w-full"
                    />
                  </div>
                )}
              </div>
            )}
          </form>
        </Modal>
      )}

      {/* Confirmação: excluir evento */}
      {confirmDelete && (
        <ConfirmDialog
          title="Excluir evento"
          message={`Excluir o evento "${confirmDelete.title}"?`}
          confirmLabel="Excluir"
          danger
          busy={removing}
          onConfirm={() => remove(confirmDelete)}
          onCancel={() => setConfirmDelete(null)}
        />
      )}

      {/* Confirmação: excluir série */}
      {confirmDeleteSeries && (
        <ConfirmDialog
          title="Excluir série"
          message={`Excluir TODA a série de "${confirmDeleteSeries.title}"? Todas as ocorrências (passadas e futuras) serão removidas.`}
          confirmLabel="Excluir série"
          danger
          busy={removing}
          onConfirm={() => removeSeries(confirmDeleteSeries)}
          onCancel={() => setConfirmDeleteSeries(null)}
        />
      )}
    </div>
  );
}
