"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DatePicker, { registerLocale } from "react-datepicker";
import { ptBR } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { api } from "@/lib/api";

registerLocale("pt-BR", ptBR);

type Room = { id: string; name: string; color: string; active: boolean };
type EventItem = {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  room: { id: string; name: string; color: string };
};

type View = "day" | "week" | "month";

const POLL_MS = 15000;

/* ----------------------------- utilidades de data ----------------------------- */
function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const dow = (x.getDay() + 6) % 7; // segunda = início
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - dow);
  return x;
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function hhmm(s: string): string {
  return new Date(s).toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// Regra do semáforo para os blocos de evento (ordem de prioridade, inclui cor do texto):
//  - encerrado (já terminou): CINZA (texto escuro)
//  - ocupada AGORA (em curso): VERMELHO (texto branco)
//  - próximo a acontecer (de cada sala): AMARELO + anel pulsante (texto escuro)
//  - agendado (futuro, ainda não começou): AZUL (texto branco)
//  (as horas livres aparecem em VERDE no fundo da grade)
function eventClasses(
  ev: EventItem,
  _todayStr: string,
  nextEventIds: Set<string>,
  nowTs: number
): string {
  const start = new Date(ev.startAt).getTime();
  const end = new Date(ev.endAt).getTime();
  if (end < nowTs) {
    return "bg-slate-300 hover:bg-slate-400 text-slate-600"; // encerrado
  }
  if (start <= nowTs && nowTs < end) {
    return "bg-red-600 hover:bg-red-700 text-white"; // ocupada agora
  }
  if (nextEventIds.has(ev.id)) {
    return "bg-yellow-400 hover:bg-yellow-500 text-slate-900 is-next ring-2 ring-yellow-300"; // a seguir
  }
  return "bg-blue-600 hover:bg-blue-700 text-white"; // agendado (futuro)
}

/* --------------------------------- componente --------------------------------- */
export default function RoomGrid() {
  const [view, setView] = useState<View>("day");
  const [date, setDate] = useState(() => ymd(new Date()));
  const [rooms, setRooms] = useState<Room[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EventItem | null>(null);
  const [kiosk, setKiosk] = useState(false);
  const [clock, setClock] = useState("");
  const [nowTs, setNowTs] = useState(() => Date.now());
  const firstLoad = useRef(true);

  const ref = useMemo(() => new Date(`${date}T12:00:00`), [date]);

  const range = useMemo(() => {
    if (view === "day") {
      return { from: new Date(`${date}T00:00:00`), to: new Date(`${date}T23:59:59`) };
    }
    if (view === "week") {
      const from = startOfWeek(ref);
      return { from, to: addDays(from, 7) };
    }
    const gridStart = startOfWeek(startOfMonth(ref));
    return { from: gridStart, to: addDays(gridStart, 42) };
  }, [view, date, ref]);

  const load = useCallback(async () => {
    try {
      const [r, e] = await Promise.all([
        api<{ rooms: Room[] }>("/api/rooms"),
        api<{ events: EventItem[] }>(
          `/api/events?from=${encodeURIComponent(
            range.from.toISOString()
          )}&to=${encodeURIComponent(range.to.toISOString())}`
        ),
      ]);
      setRooms(r.rooms.filter((x) => x.active));
      setEvents(e.events);
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      firstLoad.current = false;
    }
  }, [range]);

  useEffect(() => {
    firstLoad.current = true;
    setLoading(true);
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  // Relógio ao vivo (para o modo TV) + base de tempo para o "próximo evento".
  useEffect(() => {
    function tick() {
      const now = new Date();
      setNowTs(now.getTime());
      setClock(
        now.toLocaleTimeString("pt-PT", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      );
    }
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // Hoje (para destacar os eventos do dia) e o próximo evento a acontecer EM CADA SALA.
  const todayStr = useMemo(() => ymd(new Date(nowTs)), [nowTs]);
  const nextEventIds = useMemo(() => {
    const best = new Map<string, { id: string; t: number }>();
    for (const ev of events) {
      const t = new Date(ev.startAt).getTime();
      if (t < nowTs) continue; // já começou/passou
      const cur = best.get(ev.room.id);
      if (!cur || t < cur.t) best.set(ev.room.id, { id: ev.id, t });
    }
    return new Set([...best.values()].map((v) => v.id));
  }, [events, nowTs]);

  // Sincroniza com a saída de tela cheia via Esc.
  useEffect(() => {
    function onFs() {
      if (!document.fullscreenElement) setKiosk(false);
    }
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  async function toggleKiosk() {
    if (!kiosk) {
      try {
        await document.documentElement.requestFullscreen?.();
      } catch {
        /* ignora se o browser bloquear */
      }
      setKiosk(true);
    } else {
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen?.();
        } catch {
          /* ignora */
        }
      }
      setKiosk(false);
    }
  }

  function shift(delta: number) {
    if (view === "day") setDate(ymd(addDays(ref, delta)));
    else if (view === "week") setDate(ymd(addDays(ref, delta * 7)));
    else setDate(ymd(new Date(ref.getFullYear(), ref.getMonth() + delta, 1)));
  }

  const periodLabel = useMemo(() => {
    if (view === "day") {
      return ref.toLocaleDateString("pt-PT", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    }
    if (view === "week") {
      const a = startOfWeek(ref);
      const b = addDays(a, 6);
      const fmtA = a.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
      const fmtB = b.toLocaleDateString("pt-PT", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      return `${fmtA} – ${fmtB}`;
    }
    return ref.toLocaleDateString("pt-PT", { month: "long", year: "numeric" });
  }, [view, ref]);

  const viewSwitch = (
    <div className="inline-flex rounded-lg bg-white border border-slate-300 p-0.5">
      {([
        ["day", "Diária"],
        ["week", "Semanal"],
        ["month", "Mensal"],
      ] as [View, string][]).map(([v, label]) => (
        <button
          key={v}
          onClick={() => setView(v)}
          className={`px-3 h-8 rounded-md text-sm font-medium transition ${
            view === v ? "bg-navy text-white" : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );

  const body =
    loading && firstLoad.current ? (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center text-slate-400">
        Carregando…
      </div>
    ) : view === "day" ? (
      <DayView
        date={date}
        rooms={rooms}
        events={events}
        onSelect={setSelected}
        kiosk={kiosk}
        todayStr={todayStr}
        nextEventIds={nextEventIds}
        nowTs={nowTs}
      />
    ) : view === "week" ? (
      <WeekView
        weekStart={startOfWeek(ref)}
        rooms={rooms}
        events={events}
        onSelect={setSelected}
        kiosk={kiosk}
        todayStr={todayStr}
        nextEventIds={nextEventIds}
        nowTs={nowTs}
      />
    ) : (
      <MonthView
        refDate={ref}
        events={events}
        onSelect={setSelected}
        onPickDay={(d) => {
          setDate(d);
          setView("day");
        }}
        kiosk={kiosk}
        todayStr={todayStr}
        nextEventIds={nextEventIds}
        nowTs={nowTs}
      />
    );

  /* --------------------------------- MODO TV --------------------------------- */
  if (kiosk) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col p-4 sm:p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-extrabold text-navy">Academia TIS</h1>
            <p className="text-lg text-slate-500 capitalize">{periodLabel}</p>
          </div>
          <div className="flex items-center gap-5">
            {viewSwitch}
            <div className="text-right">
              <div className="text-4xl font-bold text-navy tabular-nums leading-none">
                {clock}
              </div>
              <div className="text-xs text-slate-500 mt-1 flex items-center justify-end gap-3">
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded bg-green-400" /> livre
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded bg-red-600" /> ocupada agora
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="is-next inline-block h-3 w-3 rounded bg-yellow-400 ring-2 ring-yellow-300" />{" "}
                  a seguir
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded bg-blue-600" /> agendado
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="inline-block h-3 w-3 rounded bg-slate-300" /> encerrado
                </span>
              </div>
            </div>
            <button
              onClick={toggleKiosk}
              className="h-10 px-4 rounded-lg bg-navy text-white text-sm font-semibold hover:bg-navy-light"
              title="Sair da tela cheia (Esc)"
            >
              ✕ Sair
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0">{body}</div>
        {selected && <EventModal event={selected} onClose={() => setSelected(null)} />}
      </div>
    );
  }

  /* --------------------------------- MODO NORMAL --------------------------------- */
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Agenda de Ocupação</h1>
          <p className="text-sm text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-green-400" /> livre
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-red-600" /> ocupada agora
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="is-next inline-block h-3 w-3 rounded bg-yellow-400 ring-2 ring-yellow-300" />{" "}
              a seguir
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-blue-600" /> agendado
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block h-3 w-3 rounded bg-slate-300" /> encerrado
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {viewSwitch}
          <button
            onClick={() => shift(-1)}
            className="h-9 w-9 rounded-lg bg-white border border-slate-300 hover:bg-slate-50"
            aria-label="Anterior"
          >
            ‹
          </button>
          <DatePicker
            selected={ref}
            onChange={(d: Date | null) => d && setDate(ymd(d))}
            dateFormat="dd/MM/yyyy"
            locale="pt-BR"
            className="rounded-lg border border-slate-300 px-3 h-9 w-32 text-sm text-center"
          />
          <button
            onClick={() => shift(1)}
            className="h-9 w-9 rounded-lg bg-white border border-slate-300 hover:bg-slate-50"
            aria-label="Próximo"
          >
            ›
          </button>
          <button
            onClick={() => setDate(ymd(new Date()))}
            className="h-9 px-3 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-600"
          >
            Hoje
          </button>
          <button
            onClick={toggleKiosk}
            className="h-9 px-3 rounded-lg bg-navy text-white text-sm font-medium hover:bg-navy-light"
            title="Modo TV / recepção (tela cheia)"
          >
            ⛶ Tela cheia
          </button>
        </div>
      </div>

      <div className="mb-3 text-sm font-semibold text-navy capitalize">
        {periodLabel}
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-200">
          {error}
        </div>
      )}

      {body}

      {selected && <EventModal event={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

/* --------------------------------- VISÃO DIÁRIA --------------------------------- */
// Horário de trabalho da grade diária.
const START_HOUR = 8;
const END_HOUR = 18;
const HOURS = Array.from(
  { length: END_HOUR - START_HOUR + 1 },
  (_, i) => START_HOUR + i
);
const TOTAL_MIN = (END_HOUR - START_HOUR) * 60;

function DayView({
  date,
  rooms,
  events,
  onSelect,
  kiosk,
  todayStr,
  nextEventIds,
  nowTs,
}: {
  date: string;
  rooms: Room[];
  events: EventItem[];
  onSelect: (e: EventItem) => void;
  kiosk: boolean;
  todayStr: string;
  nextEventIds: Set<string>;
  nowTs: number;
}) {
  const [nowMin, setNowMin] = useState<number | null>(null);

  const dayStart = useMemo(() => {
    const d = new Date(`${date}T00:00:00`);
    d.setHours(START_HOUR, 0, 0, 0);
    return d;
  }, [date]);

  useEffect(() => {
    function tick() {
      const now = new Date();
      if (ymd(now) !== date) return setNowMin(null);
      const min = (now.getTime() - dayStart.getTime()) / 60000;
      setNowMin(min >= 0 && min <= TOTAL_MIN ? min : null);
    }
    tick();
    const t = setInterval(tick, 30000);
    return () => clearInterval(t);
  }, [date, dayStart]);

  const byRoom = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const ev of events) {
      const arr = map.get(ev.room.id) || [];
      arr.push(ev);
      map.set(ev.room.id, arr);
    }
    return map;
  }, [events]);

  function minFromStart(s: string) {
    return (new Date(s).getTime() - dayStart.getTime()) / 60000;
  }

  const labelW = kiosk ? "w-56" : "w-40";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full">
      <div className="grid-scroll overflow-auto h-full">
        <div className={`${kiosk ? "h-full flex flex-col" : ""}`} style={{ minWidth: 900 }}>
          <div className="flex border-b border-slate-200 bg-slate-50">
            <div
              className={`${labelW} shrink-0 px-4 py-2 text-xs font-semibold text-slate-500 uppercase`}
            >
              Sala
            </div>
            <div className="flex-1 flex">
              {HOURS.map((h) => (
                <div
                  key={h}
                  className={`flex-1 text-center text-slate-500 font-medium py-3 border-l border-slate-100 ${
                    kiosk ? "text-lg" : "text-base"
                  }`}
                >
                  {String(h).padStart(2, "0")}h
                </div>
              ))}
            </div>
          </div>

          {rooms.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              Nenhuma sala cadastrada ainda.
            </div>
          ) : (
            <div className={`${kiosk ? "flex-1 flex flex-col" : ""}`}>
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className={`flex border-b border-slate-100 last:border-0 ${
                    kiosk ? "flex-1 min-h-[110px]" : ""
                  }`}
                >
                  <div className={`${labelW} shrink-0 px-4 py-3 flex items-center gap-2`}>
                    <span
                      className={`inline-block rounded-full ${kiosk ? "h-4 w-4" : "h-3 w-3"}`}
                      style={{ background: room.color }}
                    />
                    <span
                      className={`font-semibold text-slate-700 truncate ${
                        kiosk ? "text-xl" : "text-base"
                      }`}
                    >
                      {room.name}
                    </span>
                  </div>
                  <div
                    className={`relative flex-1 bg-green-100 ${kiosk ? "" : "h-24"}`}
                  >
                    <div className="absolute inset-0 flex pointer-events-none">
                      {HOURS.map((h) => (
                        <div key={h} className="flex-1 border-l border-white/70" />
                      ))}
                    </div>
                    {nowMin !== null && (
                      <div
                        className="absolute top-0 bottom-0 w-0.5 bg-blue-700 z-20"
                        style={{ left: `${(nowMin / TOTAL_MIN) * 100}%` }}
                      >
                        <div className="absolute -top-1 -left-1 h-2 w-2 rounded-full bg-blue-700" />
                      </div>
                    )}
                    {byRoom.get(room.id)?.map((ev) => {
                      const s = Math.max(0, minFromStart(ev.startAt));
                      const e = Math.min(TOTAL_MIN, minFromStart(ev.endAt));
                      if (e <= 0 || s >= TOTAL_MIN) return null;
                      const left = (s / TOTAL_MIN) * 100;
                      const width = ((e - s) / TOTAL_MIN) * 100;
                      return (
                        <button
                          key={ev.id}
                          onClick={() => onSelect(ev)}
                          title={`${ev.title} (${hhmm(ev.startAt)}–${hhmm(ev.endAt)})`}
                          className={`absolute rounded-md ${eventClasses(
                            ev,
                            todayStr,
                            nextEventIds,
                            nowTs
                          )} text-left overflow-hidden shadow-sm z-10 transition px-2.5 py-1.5 ${
                            kiosk ? "top-3 bottom-3 text-base" : "top-2 bottom-2 text-sm"
                          }`}
                          style={{ left: `${left}%`, width: `calc(${width}% - 4px)` }}
                        >
                          <div className="font-semibold truncate">{ev.title}</div>
                          <div className="opacity-80 truncate">
                            {hhmm(ev.startAt)}–{hhmm(ev.endAt)}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- VISÃO SEMANAL -------------------------------- */
function WeekView({
  weekStart,
  rooms,
  events,
  onSelect,
  kiosk,
  todayStr,
  nextEventIds,
  nowTs,
}: {
  weekStart: Date;
  rooms: Room[];
  events: EventItem[];
  onSelect: (e: EventItem) => void;
  kiosk: boolean;
  todayStr: string;
  nextEventIds: Set<string>;
  nowTs: number;
}) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const byCell = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const ev of events) {
      const key = `${ev.room.id}|${ymd(new Date(ev.startAt))}`;
      const arr = map.get(key) || [];
      arr.push(ev);
      map.set(key, arr);
    }
    for (const arr of map.values())
      arr.sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
    return map;
  }, [events]);

  const labelW = kiosk ? "w-56" : "w-40";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full">
      <div className="grid-scroll overflow-auto h-full">
        <div className={`${kiosk ? "h-full flex flex-col" : ""}`} style={{ minWidth: 880 }}>
          <div className="flex border-b border-slate-200 bg-slate-50">
            <div
              className={`${labelW} shrink-0 px-4 py-2 text-xs font-semibold text-slate-500 uppercase`}
            >
              Sala
            </div>
            {days.map((d, i) => {
              const isToday = ymd(d) === todayStr;
              return (
                <div
                  key={i}
                  className={`flex-1 text-center py-2 border-l border-slate-100 ${
                    isToday ? "bg-brand-50" : ""
                  }`}
                >
                  <div className={`font-semibold text-slate-500 ${kiosk ? "text-sm" : "text-xs"}`}>
                    {WEEKDAYS[i]}
                  </div>
                  <div
                    className={`${kiosk ? "text-lg" : "text-sm"} ${
                      isToday ? "text-brand-700 font-bold" : "text-slate-400"
                    }`}
                  >
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {rooms.length === 0 ? (
            <div className="p-8 text-center text-slate-400">
              Nenhuma sala cadastrada ainda.
            </div>
          ) : (
            <div className={`${kiosk ? "flex-1 flex flex-col" : ""}`}>
              {rooms.map((room) => (
                <div
                  key={room.id}
                  className={`flex border-b border-slate-100 last:border-0 ${
                    kiosk ? "flex-1 min-h-[100px]" : "min-h-[72px]"
                  }`}
                >
                  <div className={`${labelW} shrink-0 px-4 py-3 flex items-center gap-2`}>
                    <span
                      className={`inline-block rounded-full ${kiosk ? "h-4 w-4" : "h-3 w-3"}`}
                      style={{ background: room.color }}
                    />
                    <span
                      className={`font-semibold text-slate-700 truncate ${
                        kiosk ? "text-lg" : "text-sm"
                      }`}
                    >
                      {room.name}
                    </span>
                  </div>
                  {days.map((d, i) => {
                    const evs = byCell.get(`${room.id}|${ymd(d)}`) || [];
                    const isToday = ymd(d) === todayStr;
                    return (
                      <div
                        key={i}
                        className={`flex-1 min-w-0 border-l border-slate-100 p-1.5 space-y-1 ${
                          isToday ? "bg-brand-50/40" : ""
                        }`}
                      >
                        {evs.length === 0 ? (
                          <div className="h-full min-h-[44px] rounded bg-green-100" />
                        ) : (
                          evs.map((ev) => (
                            <button
                              key={ev.id}
                              onClick={() => onSelect(ev)}
                              title={`${ev.title} (${hhmm(ev.startAt)}–${hhmm(ev.endAt)})`}
                              className={`block w-full rounded ${eventClasses(
                                ev,
                                todayStr,
                                nextEventIds,
                                nowTs
                              )} text-left transition px-2 py-1 ${
                                kiosk ? "text-sm" : "text-[11px]"
                              }`}
                            >
                              <div className="font-semibold truncate">{ev.title}</div>
                              <div className="opacity-80">{hhmm(ev.startAt)}</div>
                            </button>
                          ))
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* --------------------------------- VISÃO MENSAL --------------------------------- */
function MonthView({
  refDate,
  events,
  onSelect,
  onPickDay,
  kiosk,
  todayStr,
  nextEventIds,
  nowTs,
}: {
  refDate: Date;
  events: EventItem[];
  onSelect: (e: EventItem) => void;
  onPickDay: (ymd: string) => void;
  kiosk: boolean;
  todayStr: string;
  nextEventIds: Set<string>;
  nowTs: number;
}) {
  const gridStart = startOfWeek(startOfMonth(refDate));
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const month = refDate.getMonth();

  const byDay = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const ev of events) {
      const key = ymd(new Date(ev.startAt));
      const arr = map.get(key) || [];
      arr.push(ev);
      map.set(key, arr);
    }
    for (const arr of map.values())
      arr.sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
    return map;
  }, [events]);

  const MAX = kiosk ? 4 : 3;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
      <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className={`text-center font-semibold text-slate-500 py-2 ${
              kiosk ? "text-base" : "text-xs"
            }`}
          >
            {w}
          </div>
        ))}
      </div>
      <div className={`grid grid-cols-7 ${kiosk ? "flex-1 grid-rows-6" : ""}`}>
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === month;
          const dStr = ymd(d);
          const isToday = dStr === todayStr;
          const evs = byDay.get(dStr) || [];
          return (
            <div
              key={i}
              className={`min-w-0 overflow-hidden border-b border-l border-slate-100 p-1.5 [&:nth-child(7n)]:border-r-0 ${
                kiosk ? "min-h-0" : "min-h-[104px]"
              } ${inMonth ? "bg-white" : "bg-slate-50/60"}`}
            >
              <button
                onClick={() => onPickDay(dStr)}
                className={`mb-1 flex items-center justify-center rounded-full transition hover:bg-brand-100 ${
                  kiosk ? "h-8 w-8 text-sm" : "h-6 w-6 text-xs"
                } ${
                  isToday
                    ? "bg-navy text-white font-bold"
                    : inMonth
                    ? "text-slate-600"
                    : "text-slate-300"
                }`}
                title="Ver dia"
              >
                {d.getDate()}
              </button>
              <div className="space-y-0.5">
                {evs.slice(0, MAX).map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => onSelect(ev)}
                    title={`${ev.title} · ${ev.room.name} (${hhmm(ev.startAt)})`}
                    className={`block w-full text-left rounded ${eventClasses(
                      ev,
                      todayStr,
                      nextEventIds,
                      nowTs
                    )} truncate transition px-1.5 py-0.5 ${
                      kiosk ? "text-xs" : "text-[10px]"
                    }`}
                  >
                    <span className="opacity-80">{hhmm(ev.startAt)} </span>
                    {ev.title}
                  </button>
                ))}
                {evs.length > MAX && (
                  <button
                    onClick={() => onPickDay(dStr)}
                    className={`text-brand-600 hover:underline pl-1 ${
                      kiosk ? "text-xs" : "text-[10px]"
                    }`}
                  >
                    +{evs.length - MAX} mais
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------------------------- MODAL --------------------------------------- */
function EventModal({ event, onClose }: { event: EventItem; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-navy text-white px-5 py-4">
          <h3 className="font-bold text-lg">{event.title}</h3>
          <p className="text-brand-200 text-sm">{event.room.name}</p>
        </div>
        <div className="p-5 space-y-2 text-sm">
          <ModalRow label="Início" value={new Date(event.startAt).toLocaleString("pt-PT")} />
          <ModalRow label="Fim" value={new Date(event.endAt).toLocaleString("pt-PT")} />
          {event.description && <ModalRow label="Descrição" value={event.description} />}
        </div>
        <div className="px-5 pb-5">
          <button
            onClick={onClose}
            className="w-full rounded-lg bg-slate-100 hover:bg-slate-200 py-2 text-sm font-medium"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-slate-400 w-20 shrink-0">{label}</span>
      <span className="text-slate-800 font-medium">{value}</span>
    </div>
  );
}
