"use client";

import { useCallback, useEffect, useState } from "react";
import DatePicker, { registerLocale } from "react-datepicker";
import { ptBR } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { api } from "@/lib/api";

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

function statusOf(ev: EventItem) {
  const n = Date.now();
  const s = new Date(ev.startAt).getTime();
  const e = new Date(ev.endAt).getTime();
  if (e < n) return { label: "Encerrado", cls: "bg-slate-100 text-slate-500" };
  if (s <= n) return { label: "Em curso", cls: "bg-red-100 text-red-700" };
  return { label: "Agendado", cls: "bg-green-100 text-green-700" };
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

  // Ao mudar um filtro, volta para a página 1.
  function changeFilter(setter: (v: string) => void, value: string) {
    setter(value);
    setPage(1);
  }
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
          alert(
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
    if (!confirm(`Excluir o evento "${ev.title}"?`)) return;
    try {
      await api(`/api/events/${ev.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  async function removeSeries(ev: EventItem) {
    if (
      !confirm(
        `Excluir TODA a série de "${ev.title}"? Todas as ocorrências (passadas e futuras) serão removidas.`
      )
    )
      return;
    try {
      const r = await api<{ deleted: number }>(
        `/api/events/${ev.id}?series=1`,
        { method: "DELETE" }
      );
      await load();
      alert(`Série removida: ${r.deleted} ocorrência(s).`);
    } catch (err) {
      alert((err as Error).message);
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
          <button
            onClick={openCreate}
            disabled={rooms.length === 0}
            className="rounded-lg bg-navy text-white px-4 py-2 text-sm font-semibold hover:bg-navy-light disabled:opacity-50"
          >
            + Novo evento
          </button>
        )}
      </div>

      {/* Barra de filtros */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3 mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Sala
          </label>
          <select
            value={fRoom}
            onChange={(e) => changeFilter(setFRoom, e.target.value)}
            className="rounded-lg border border-slate-300 px-3 h-9 text-sm bg-white"
          >
            <option value="">Todas as salas</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            De
          </label>
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
            className="rounded-lg border border-slate-300 px-3 h-9 text-sm w-36"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">
            Até
          </label>
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
            className="rounded-lg border border-slate-300 px-3 h-9 text-sm w-36"
          />
        </div>
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="h-9 px-3 rounded-lg border border-slate-300 text-sm text-slate-600 hover:bg-slate-50"
          >
            Limpar filtros
          </button>
        )}
        <div className="ml-auto text-sm text-slate-500 self-center">
          {total} evento{total === 1 ? "" : "s"}
        </div>
      </div>

      {error && !showForm && (
        <div className="mb-3 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-200">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Carregando…</div>
        ) : events.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            Nenhum evento encontrado{hasFilters ? " com esses filtros" : ""}.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Evento</th>
                <th className="px-4 py-3 font-medium">Sala</th>
                <th className="px-4 py-3 font-medium">Início</th>
                <th className="px-4 py-3 font-medium">Fim</th>
                <th className="px-4 py-3 font-medium">Status</th>
                {canManage && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody>
              {events.map((ev) => {
                const st = statusOf(ev);
                return (
                  <tr key={ev.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {ev.title}
                      {ev.seriesId && (
                        <span
                          className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-brand-100 text-brand-700 align-middle"
                          title="Faz parte de uma série recorrente"
                        >
                          ↻ série
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-2 text-slate-600">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: ev.room.color }}
                        />
                        {ev.room.name}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{fmt(ev.startAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{fmt(ev.endAt)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.cls}`}
                      >
                        {st.label}
                      </span>
                    </td>
                    {canManage && (
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          onClick={() => openEdit(ev)}
                          className="text-brand-600 hover:underline mr-3"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => remove(ev)}
                          className="text-red-600 hover:underline"
                        >
                          Excluir
                        </button>
                        {ev.seriesId && (
                          <button
                            onClick={() => removeSeries(ev)}
                            className="text-red-700 font-medium hover:underline ml-3"
                          >
                            Excluir série
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Paginação */}
        {total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-sm">
            <span className="text-slate-500">
              Mostrando {fromIdx}–{toIdx} de {total}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="h-8 px-3 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-50"
              >
                ‹ Anterior
              </button>
              <span className="text-slate-600">
                Página {page} de {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="h-8 px-3 rounded-lg border border-slate-300 disabled:opacity-40 hover:bg-slate-50"
              >
                Próximo ›
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de criar/editar */}
      {showForm && (
        <div
          className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4"
          onClick={() => setShowForm(false)}
        >
          <form
            onSubmit={save}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full"
          >
            <div className="bg-navy text-white px-5 py-4 font-bold rounded-t-2xl">
              {form.id ? "Editar evento" : "Novo evento"}
            </div>
            <div className="p-5 space-y-3">
              {error && (
                <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-200">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Título *
                </label>
                <input
                  required
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Sala *
                </label>
                <select
                  required
                  value={form.roomId}
                  onChange={(e) => setForm({ ...form, roomId: e.target.value })}
                  className="input"
                >
                  <option value="">Selecione…</option>
                  {rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Início *
                  </label>
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
                    className="input"
                    wrapperClassName="w-full"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Fim *
                  </label>
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
                    className="input"
                    wrapperClassName="w-full"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Descrição
                </label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  className="input"
                />
              </div>
              {!form.id && (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Repetir
                    </label>
                    <select
                      value={form.repeat}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          repeat: e.target.value as typeof form.repeat,
                          repeatUntil:
                            e.target.value === "none" ? null : form.repeatUntil,
                        })
                      }
                      className="input"
                    >
                      <option value="none">Não repete</option>
                      <option value="daily">Diariamente (seg–sáb)</option>
                      <option value="weekly">Semanalmente</option>
                      <option value="monthly">Mensalmente</option>
                    </select>
                  </div>
                  {form.repeat !== "none" && (
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Repetir até *
                      </label>
                      <DatePicker
                        selected={form.repeatUntil}
                        onChange={(d: Date | null) =>
                          setForm({ ...form, repeatUntil: d })
                        }
                        dateFormat="dd/MM/yyyy"
                        locale="pt-BR"
                        minDate={form.startAt}
                        placeholderText="dd/mm/aaaa"
                        className="input"
                        wrapperClassName="w-full"
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-lg bg-slate-100 hover:bg-slate-200 py-2 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg bg-navy text-white py-2 text-sm font-semibold hover:bg-navy-light disabled:opacity-60"
              >
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #cbd5e1;
          padding: 0.5rem 0.75rem;
          outline: none;
          background: white;
        }
        .input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px #bfdbfe;
        }
      `}</style>
    </div>
  );
}
