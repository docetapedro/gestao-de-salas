"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import DatePicker, { registerLocale } from "react-datepicker";
import { ptBR } from "date-fns/locale";
import "react-datepicker/dist/react-datepicker.css";
import { ChevronLeft, ChevronRight, Maximize2, Plus, X } from "lucide-react";
import { api } from "@/lib/api";
import { useLivePoll } from "@/lib/useLivePoll";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

registerLocale("pt-BR", ptBR);

type Room = { id: string; name: string; color: string; active: boolean };
type EventItem = {
  id: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string;
  seriesId?: string | null;
  room: { id: string; name: string; color: string };
};

// Dentro de um mesmo dia, uma série recorrente deve ocupar no máximo UM bloco:
// as ocorrências multi-dia de uma série sobrepõem-se e, de outro modo, cada uma
// seria replicada em todos os dias que abrange, enchendo a grelha. Mantém a 1.ª
// ocorrência de cada série; eventos sem série são todos mantidos.
function collapseSeriesPerDay(list: EventItem[]): EventItem[] {
  const seen = new Set<string>();
  const out: EventItem[] = [];
  for (const ev of list) {
    if (ev.seriesId) {
      if (seen.has(ev.seriesId)) continue;
      seen.add(ev.seriesId);
    }
    out.push(ev);
  }
  return out;
}

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
function atTime(base: Date, h: number, m: number): Date {
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
}

type CreatePrefill = { roomId?: string; start: Date; end: Date };
type Repeat = "none" | "daily" | "weekly" | "monthly";
type CForm = {
  title: string;
  roomId: string;
  startAt: Date;
  endAt: Date;
  description: string;
  repeat: Repeat;
  repeatUntil: Date | null;
};
function hhmm(s: string): string {
  return new Date(s).toLocaleTimeString("pt-PT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
// Dias (ymd) que um evento cobre, para o mostrar em cada dia das vistas
// semanal/mensal. Um evento que acaba exatamente à meia-noite não conta o
// último dia (acaba no início desse dia).
function eventDayKeys(ev: EventItem): string[] {
  const start = new Date(ev.startAt);
  const end = new Date(ev.endAt);
  const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
  if (
    end.getHours() === 0 &&
    end.getMinutes() === 0 &&
    end.getSeconds() === 0 &&
    last > d
  ) {
    last.setDate(last.getDate() - 1);
  }
  const keys: string[] = [];
  while (d <= last) {
    keys.push(ymd(d));
    d.setDate(d.getDate() + 1);
  }
  return keys.length ? keys : [ymd(start)];
}
// Intervalo início–fim de um evento, legível na lista da modal do dia. Para
// eventos de vários dias mostra data+hora nos dois extremos.
function eventRangeLabel(ev: EventItem): string {
  const s = new Date(ev.startAt);
  const e = new Date(ev.endAt);
  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();
  if (sameDay) return `${hhmm(ev.startAt)}–${hhmm(ev.endAt)}`;
  const d = (x: string) =>
    new Date(x).toLocaleDateString("pt-PT", { day: "2-digit", month: "2-digit" });
  return `${d(ev.startAt)} ${hhmm(ev.startAt)} → ${d(ev.endAt)} ${hhmm(ev.endAt)}`;
}
// Rótulo de hora para um evento num dado dia (lida com eventos de vários dias).
function spanTimeLabel(ev: EventItem, dStr: string): string {
  const keys = eventDayKeys(ev);
  if (keys.length === 1) return hhmm(ev.startAt);
  if (dStr === keys[0]) return `${hhmm(ev.startAt)} →`;
  if (dStr === keys[keys.length - 1]) return `→ ${hhmm(ev.endAt)}`;
  return "→";
}
// Dias úteis exibidos (domingo removido): segunda a sábado.
const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const DAYS_SHOWN = WEEKDAYS.length; // 6

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

/* ---------------------------------- legenda ----------------------------------- */
const LEGEND: { dot: string; label: string; isNext?: boolean }[] = [
  { dot: "bg-green-400", label: "livre" },
  { dot: "bg-red-600", label: "ocupada agora" },
  { dot: "bg-yellow-400 ring-2 ring-yellow-300", label: "a seguir", isNext: true },
  { dot: "bg-blue-600", label: "agendado" },
  { dot: "bg-slate-300", label: "encerrado" },
];

function Legend({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", className)}>
      {LEGEND.map((l) => (
        <span
          key={l.label}
          className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2 py-0.5 text-slate-600"
        >
          <span
            className={cn(
              "inline-block h-3 w-3 rounded",
              l.dot,
              l.isNext && "is-next"
            )}
          />
          {l.label}
        </span>
      ))}
    </div>
  );
}

/* --------------------------------- componente --------------------------------- */
export default function RoomGrid({
  publicMode = false,
}: {
  // Modo público (agenda sem sessão): leitura apenas, endpoints públicos.
  publicMode?: boolean;
} = {}) {
  const [view, setView] = useState<View>("day");
  const [date, setDate] = useState(() => ymd(new Date()));
  const [rooms, setRooms] = useState<Room[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<EventItem | null>(null);
  // Dia (ymd) cujos eventos estão a ser listados na modal "eventos do dia".
  const [dayModal, setDayModal] = useState<string | null>(null);
  const [kiosk, setKiosk] = useState(false);
  const [clock, setClock] = useState("");
  const [nowTs, setNowTs] = useState(() => Date.now());
  const firstLoad = useRef(true);

  // Criação de evento via clique na grade
  const [canManage, setCanManage] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [cForm, setCForm] = useState<CForm>({
    title: "",
    roomId: "",
    startAt: new Date(),
    endAt: new Date(),
    description: "",
    repeat: "none",
    repeatUntil: null,
  });
  const [cSaving, setCSaving] = useState(false);
  const [cError, setCError] = useState<string | null>(null);

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
      const roomsUrl = publicMode ? "/api/public/rooms" : "/api/rooms";
      const eventsBase = publicMode ? "/api/public/events" : "/api/events";
      // no-store: obriga a ir ao servidor a cada poll (que serve do Data Cache,
      // sem tocar no Neon), para não ficar preso a uma resposta em cache do browser.
      const [r, e] = await Promise.all([
        api<{ rooms: Room[] }>(roomsUrl, { cache: "no-store" }),
        api<{ events: EventItem[] }>(
          `${eventsBase}?from=${encodeURIComponent(
            range.from.toISOString()
          )}&to=${encodeURIComponent(range.to.toISOString())}`,
          { cache: "no-store" }
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
  }, [range, publicMode]);

  useEffect(() => {
    firstLoad.current = true;
    setLoading(true);
  }, [load]);

  // As leituras públicas vêm do cache (revalidadas ao criar/editar/eliminar),
  // por isso o polling não gasta compute do Neon. Só pára quando o separador
  // está escondido — o quadro da entrada fica vivo 24/7.
  useLivePoll(load, POLL_MS);

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

  // Permissão para criar eventos (ADMIN/MANAGER). No modo público não há
  // sessão — fica sempre em leitura apenas.
  useEffect(() => {
    if (publicMode) return;
    api<{ user: { role: string } }>("/api/auth/me")
      .then((r) => setCanManage(["ADMIN", "MANAGER"].includes(r.user.role)))
      .catch(() => {});
  }, [publicMode]);

  function openCreate(prefill: CreatePrefill) {
    if (!canManage || rooms.length === 0) return;
    setCForm({
      title: "",
      roomId: prefill.roomId || rooms[0]?.id || "",
      startAt: prefill.start,
      endAt: prefill.end,
      description: "",
      repeat: "none",
      repeatUntil: null,
    });
    setCError(null);
    setCreateOpen(true);
  }

  async function saveCreate(e: React.FormEvent) {
    e.preventDefault();
    if (cForm.repeat !== "none" && !cForm.repeatUntil) {
      setCError("Informe a data limite da repetição");
      return;
    }
    setCSaving(true);
    setCError(null);
    try {
      const res = await api<{ created?: number; skipped?: number }>(
        "/api/events",
        {
          method: "POST",
          body: JSON.stringify({
            title: cForm.title,
            roomId: cForm.roomId,
            startAt: cForm.startAt.toISOString(),
            endAt: cForm.endAt.toISOString(),
            description: cForm.description || null,
            repeat: cForm.repeat,
            repeatUntil: cForm.repeatUntil
              ? cForm.repeatUntil.toISOString()
              : null,
          }),
        }
      );
      setCreateOpen(false);
      await load();
      if (cForm.repeat !== "none" && res.created !== undefined) {
        alert(
          `Série criada: ${res.created} evento(s).` +
            (res.skipped ? ` ${res.skipped} ignorado(s) por conflito.` : "")
        );
      }
    } catch (err) {
      setCError((err as Error).message);
    } finally {
      setCSaving(false);
    }
  }

  // Abre a modal com os eventos de um dia (todas as salas).
  function openDay(dStr: string) {
    setDayModal(dStr);
  }

  // Botão "Novo": abre a criação pré-preenchida com a hora atual (arredondada
  // ao próximo quarto de hora) e duração de 1 hora.
  function openCreateNow() {
    const start = new Date();
    start.setSeconds(0, 0);
    start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15);
    openCreate({ start, end: new Date(start.getTime() + 60 * 60000) });
  }

  // "Novo neste dia" (a partir da modal de eventos do dia): pré-preenche o dia
  // às 08:00–09:00 e fecha a lista.
  function openCreateDay(dStr: string) {
    const base = new Date(`${dStr}T00:00:00`);
    setDayModal(null);
    openCreate({ start: atTime(base, START_HOUR, 0), end: atTime(base, START_HOUR + 1, 0) });
  }

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
    <div className="inline-flex rounded-lg bg-white border border-slate-300 p-0.5 shadow-sm">
      {([
        ["day", "Diária"],
        ["week", "Semanal"],
        ["month", "Mensal"],
      ] as [View, string][]).map(([v, label]) => (
        <Button
          key={v}
          type="button"
          variant={view === v ? "navy" : "ghost"}
          size="sm"
          onClick={() => setView(v)}
          className={cn(
            "h-8 rounded-md",
            view === v ? "" : "text-slate-600 hover:bg-slate-100"
          )}
        >
          {label}
        </Button>
      ))}
    </div>
  );

  const body =
    loading && firstLoad.current ? (
      <Card className="p-8 text-center text-slate-400 rounded-2xl">
        Carregando…
      </Card>
    ) : view === "day" ? (
      <DayView
        date={date}
        rooms={rooms}
        events={events}
        onSelect={setSelected}
        onDayClick={openDay}
        kiosk={kiosk}
        todayStr={todayStr}
        nextEventIds={nextEventIds}
        nowTs={nowTs}
        onCreate={openCreate}
        canManage={canManage}
      />
    ) : view === "week" ? (
      <WeekView
        weekStart={startOfWeek(ref)}
        rooms={rooms}
        events={events}
        onSelect={setSelected}
        onDayClick={openDay}
        kiosk={kiosk}
        todayStr={todayStr}
        nextEventIds={nextEventIds}
        nowTs={nowTs}
        onCreate={openCreate}
        canManage={canManage}
      />
    ) : (
      <MonthView
        refDate={ref}
        events={events}
        onSelect={setSelected}
        onDayClick={openDay}
        kiosk={kiosk}
        todayStr={todayStr}
        nextEventIds={nextEventIds}
        nowTs={nowTs}
        onCreate={openCreate}
        canManage={canManage}
      />
    );

  /* --------------------------------- MODO TV --------------------------------- */
  if (kiosk) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col p-4 sm:p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/Logo1.png"
              alt="Academia TIS"
              className="h-12 object-contain object-left"
            />
            <p className="text-lg text-slate-500 capitalize">{periodLabel}</p>
          </div>
          <div className="flex items-center gap-5">
            {viewSwitch}
            <div className="text-right">
              <div className="text-4xl font-bold text-navy tabular-nums leading-none">
                {clock}
              </div>
              <Legend className="mt-1 justify-end text-xs" />
            </div>
            {canManage && (
              <Button
                variant="default"
                size="lg"
                onClick={openCreateNow}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
                title="Criar novo evento"
              >
                <Plus className="h-4 w-4" /> Novo
              </Button>
            )}
            <Button
              variant="navy"
              size="lg"
              onClick={toggleKiosk}
              title="Sair da tela cheia (Esc)"
            >
              <X className="h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
        <div className="flex-1 min-h-0">{body}</div>
        {dayModal && (
          <DayEventsModal
            dayStr={dayModal}
            events={events}
            onSelect={(ev) => setSelected(ev)}
            onClose={() => setDayModal(null)}
            canManage={canManage}
            onCreateDay={() => openCreateDay(dayModal)}
          />
        )}
        {selected && <EventModal event={selected} onClose={() => setSelected(null)} />}
        {createOpen && (
          <CreateEventModal
            form={cForm}
            setForm={setCForm}
            rooms={rooms}
            onSubmit={saveCreate}
            onClose={() => setCreateOpen(false)}
            saving={cSaving}
            error={cError}
          />
        )}
      </div>
    );
  }

  /* --------------------------------- MODO NORMAL --------------------------------- */
  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Agenda de Ocupação</h1>
          <Legend className="mt-1 text-sm" />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {viewSwitch}
          <Button
            variant="outline"
            size="icon"
            onClick={() => shift(-1)}
            aria-label="Anterior"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <DatePicker
            selected={ref}
            onChange={(d: Date | null) => d && setDate(ymd(d))}
            dateFormat="dd/MM/yyyy"
            locale="pt-BR"
            className="rounded-md border border-input bg-background px-3 h-9 w-32 text-sm text-center shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          />
          <Button
            variant="outline"
            size="icon"
            onClick={() => shift(1)}
            aria-label="Próximo"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="default"
            onClick={() => setDate(ymd(new Date()))}
            className="bg-brand-500 hover:bg-brand-600"
          >
            Hoje
          </Button>
          <Button
            variant="navy"
            onClick={toggleKiosk}
            title="Modo TV / recepção (tela cheia)"
          >
            <Maximize2 className="h-4 w-4" /> Tela cheia
          </Button>
          {canManage && (
            <Button
              variant="default"
              onClick={openCreateNow}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              title="Criar novo evento"
            >
              <Plus className="h-4 w-4" /> Novo
            </Button>
          )}
        </div>
      </div>

      <div className="mb-3 text-sm font-semibold text-navy capitalize">
        {periodLabel}
      </div>

      {error && (
        <div className="mb-3 rounded-md bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-200">
          {error}
        </div>
      )}

      {body}

      {dayModal && (
        <DayEventsModal
          dayStr={dayModal}
          events={events}
          onSelect={(ev) => setSelected(ev)}
          onClose={() => setDayModal(null)}
          canManage={canManage}
          onCreateDay={() => openCreateDay(dayModal)}
        />
      )}
      {selected && <EventModal event={selected} onClose={() => setSelected(null)} />}
      {createOpen && (
        <CreateEventModal
          form={cForm}
          setForm={setCForm}
          rooms={rooms}
          onSubmit={saveCreate}
          onClose={() => setCreateOpen(false)}
          saving={cSaving}
          error={cError}
        />
      )}
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
  onDayClick,
  kiosk,
  todayStr,
  nextEventIds,
  nowTs,
  onCreate,
  canManage,
}: {
  date: string;
  rooms: Room[];
  events: EventItem[];
  onSelect: (e: EventItem) => void;
  onDayClick: (ymd: string) => void;
  kiosk: boolean;
  todayStr: string;
  nextEventIds: Set<string>;
  nowTs: number;
  onCreate: (p: CreatePrefill) => void;
  canManage: boolean;
}) {
  const [nowMin, setNowMin] = useState<number | null>(null);

  const dayStart = useMemo(() => {
    const d = new Date(`${date}T00:00:00`);
    d.setHours(START_HOUR, 0, 0, 0);
    return d;
  }, [date]);

  // Seleção por arrasto na linha do tempo (minutos desde START_HOUR): abre a
  // modal com as horas de início/fim (arredondadas à hora).
  const [tdrag, setTdrag] = useState<{
    roomId: string;
    aMin: number;
    bMin: number;
  } | null>(null);
  const tdragRef = useRef(tdrag);
  tdragRef.current = tdrag;
  const dayStartRef = useRef(dayStart);
  dayStartRef.current = dayStart;
  const onCreateRef = useRef(onCreate);
  onCreateRef.current = onCreate;
  const onDayClickRef = useRef(onDayClick);
  onDayClickRef.current = onDayClick;
  const canManageRef = useRef(canManage);
  canManageRef.current = canManage;
  const dateRef = useRef(date);
  dateRef.current = date;
  useEffect(() => {
    function up() {
      const d = tdragRef.current;
      if (!d) return;
      setTdrag(null);
      const lo = Math.min(d.aMin, d.bMin);
      const hi = Math.max(d.aMin, d.bMin);
      // Clique simples (sem arrasto apreciável) ou sem permissão → lista os
      // eventos do dia em vez de criar.
      if (hi - lo < 10 || !canManageRef.current) {
        onDayClickRef.current(dateRef.current);
        return;
      }
      const startMin = Math.floor(lo / 60) * 60;
      let endMin = Math.ceil(hi / 60) * 60;
      if (endMin <= startMin) endMin = startMin + 60;
      const base = dayStartRef.current.getTime();
      onCreateRef.current({
        roomId: d.roomId,
        start: new Date(base + startMin * 60000),
        end: new Date(base + endMin * 60000),
      });
    }
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

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
    // Um bloco por série em cada sala (evita a pilha de ocorrências sobrepostas).
    for (const [k, arr] of map) {
      arr.sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
      map.set(k, collapseSeriesPerDay(arr));
    }
    return map;
  }, [events]);

  function minFromStart(s: string) {
    return (new Date(s).getTime() - dayStart.getTime()) / 60000;
  }

  const labelW = kiosk ? "w-56" : "w-40";

  return (
    <Card className="rounded-2xl overflow-hidden h-full">
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
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const rect = e.currentTarget.getBoundingClientRect();
                      const m =
                        Math.max(
                          0,
                          Math.min(0.999, (e.clientX - rect.left) / rect.width)
                        ) * TOTAL_MIN;
                      setTdrag({ roomId: room.id, aMin: m, bMin: m });
                    }}
                    onMouseMove={(e) => {
                      const dr = tdragRef.current;
                      if (!dr || dr.roomId !== room.id) return;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const m =
                        Math.max(
                          0,
                          Math.min(0.999, (e.clientX - rect.left) / rect.width)
                        ) * TOTAL_MIN;
                      setTdrag({ ...dr, bMin: m });
                    }}
                    title={
                      canManage
                        ? "Clique para ver eventos · arraste para marcar"
                        : "Clique para ver os eventos do dia"
                    }
                    className={`relative flex-1 bg-green-100 cursor-pointer select-none ${
                      kiosk ? "" : "h-24"
                    }`}
                  >
                    <div className="absolute inset-0 flex pointer-events-none">
                      {HOURS.map((h) => (
                        <div key={h} className="flex-1 border-l border-white/70" />
                      ))}
                    </div>
                    {canManage &&
                      tdrag &&
                      tdrag.roomId === room.id &&
                      (() => {
                        const lo = Math.min(tdrag.aMin, tdrag.bMin);
                        const hi = Math.max(tdrag.aMin, tdrag.bMin);
                        const s = Math.floor(lo / 60) * 60;
                        let e2 = Math.ceil(hi / 60) * 60;
                        if (e2 <= s) e2 = s + 60;
                        return (
                          <div
                            className="absolute top-1 bottom-1 rounded-md bg-brand-400/40 ring-2 ring-brand-500 z-[5] pointer-events-none"
                            style={{
                              left: `${(s / TOTAL_MIN) * 100}%`,
                              width: `${((e2 - s) / TOTAL_MIN) * 100}%`,
                            }}
                          />
                        );
                      })()}
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
                          onMouseDown={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(ev);
                          }}
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
    </Card>
  );
}

/* --------------------------------- VISÃO SEMANAL -------------------------------- */
function WeekView({
  weekStart,
  rooms,
  events,
  onSelect,
  onDayClick,
  kiosk,
  todayStr,
  nextEventIds,
  nowTs,
  onCreate,
  canManage,
}: {
  weekStart: Date;
  rooms: Room[];
  events: EventItem[];
  onSelect: (e: EventItem) => void;
  onDayClick: (ymd: string) => void;
  kiosk: boolean;
  todayStr: string;
  nextEventIds: Set<string>;
  nowTs: number;
  onCreate: (p: CreatePrefill) => void;
  canManage: boolean;
}) {
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(weekStart, i));

  // Seleção por arrasto: escolher vários dias (na linha de uma sala) e abrir a
  // modal com início = 1.º dia e fim = último dia selecionado.
  const [drag, setDrag] = useState<{ roomId: string; a: number; b: number } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const daysRef = useRef(days);
  daysRef.current = days;
  const onCreateRef = useRef(onCreate);
  onCreateRef.current = onCreate;
  const onDayClickRef = useRef(onDayClick);
  onDayClickRef.current = onDayClick;
  const canManageRef = useRef(canManage);
  canManageRef.current = canManage;
  useEffect(() => {
    function up() {
      const d = dragRef.current;
      if (!d) return;
      setDrag(null);
      const lo = Math.min(d.a, d.b);
      const hi = Math.max(d.a, d.b);
      const dd = daysRef.current;
      const startD = dd[lo];
      const endD = dd[hi];
      if (!startD || !endD) return;
      // Clique simples (um só dia) ou sem permissão → lista os eventos do dia.
      if (lo === hi || !canManageRef.current) {
        onDayClickRef.current(ymd(startD));
        return;
      }
      // Arrasto por vários dias → um evento contínuo (do 1.º ao último dia).
      onCreateRef.current({
        roomId: d.roomId,
        start: atTime(startD, START_HOUR, 0),
        end: atTime(endD, END_HOUR, 0),
      });
    }
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  const byCell = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const ev of events) {
      // Evento de vários dias aparece em cada dia que abrange.
      for (const dayKey of eventDayKeys(ev)) {
        const key = `${ev.room.id}|${dayKey}`;
        const arr = map.get(key) || [];
        arr.push(ev);
        map.set(key, arr);
      }
    }
    for (const [key, arr] of map) {
      arr.sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
      map.set(key, collapseSeriesPerDay(arr)); // 1 bloco por série em cada dia
    }
    return map;
  }, [events]);

  const labelW = kiosk ? "w-56" : "w-40";

  return (
    <Card className="rounded-2xl overflow-hidden h-full">
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
                    const sel =
                      drag && drag.roomId === room.id
                        ? {
                            lo: Math.min(drag.a, drag.b),
                            hi: Math.max(drag.a, drag.b),
                          }
                        : null;
                    const selected =
                      canManage && !!sel && i >= sel.lo && i <= sel.hi;
                    return (
                      <div
                        key={i}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setDrag({ roomId: room.id, a: i, b: i });
                        }}
                        onMouseEnter={() => {
                          const dr = dragRef.current;
                          if (dr && dr.roomId === room.id)
                            setDrag({ roomId: room.id, a: dr.a, b: i });
                        }}
                        title={
                          canManage
                            ? "Clique para ver eventos · arraste para marcar"
                            : "Clique para ver os eventos do dia"
                        }
                        className={`flex-1 min-w-0 border-l border-slate-100 p-1.5 space-y-1 cursor-pointer hover:bg-slate-50/60 ${
                          isToday ? "bg-brand-50/40" : ""
                        } ${
                          selected ? "bg-brand-100 ring-2 ring-inset ring-brand-400" : ""
                        }`}
                      >
                        {evs.length === 0 ? (
                          <div className="h-full min-h-[44px] rounded bg-green-100" />
                        ) : (
                          evs.map((ev) => (
                            <button
                              key={ev.id}
                              onMouseDown={(e) => e.stopPropagation()}
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelect(ev);
                              }}
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
                              <div className="opacity-80">
                                {spanTimeLabel(ev, ymd(d))}
                              </div>
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
    </Card>
  );
}

/* --------------------------------- VISÃO MENSAL --------------------------------- */
function MonthView({
  refDate,
  events,
  onSelect,
  onDayClick,
  kiosk,
  todayStr,
  nextEventIds,
  nowTs,
  onCreate,
  canManage,
}: {
  refDate: Date;
  events: EventItem[];
  onSelect: (e: EventItem) => void;
  onDayClick: (ymd: string) => void;
  kiosk: boolean;
  todayStr: string;
  nextEventIds: Set<string>;
  nowTs: number;
  onCreate: (p: CreatePrefill) => void;
  canManage: boolean;
}) {
  const gridStart = startOfWeek(startOfMonth(refDate)); // segunda-feira
  // 6 semanas × 6 dias (segunda a sábado), pulando os domingos.
  const cells: Date[] = [];
  for (let w = 0; w < 6; w++) {
    for (let di = 0; di < DAYS_SHOWN; di++) {
      cells.push(addDays(gridStart, w * 7 + di));
    }
  }
  const month = refDate.getMonth();

  // Seleção por arrasto: escolher vários dias e abrir a modal com início = 1.º
  // dia e fim = último dia selecionado.
  const [drag, setDrag] = useState<{ a: number; b: number } | null>(null);
  const dragRef = useRef(drag);
  dragRef.current = drag;
  const cellsRef = useRef(cells);
  cellsRef.current = cells;
  const onCreateRef = useRef(onCreate);
  onCreateRef.current = onCreate;
  const onDayClickRef = useRef(onDayClick);
  onDayClickRef.current = onDayClick;
  const canManageRef = useRef(canManage);
  canManageRef.current = canManage;
  useEffect(() => {
    function up() {
      const d = dragRef.current;
      if (!d) return;
      setDrag(null);
      const lo = Math.min(d.a, d.b);
      const hi = Math.max(d.a, d.b);
      const cc = cellsRef.current;
      const startD = cc[lo];
      const endD = cc[hi];
      if (!startD || !endD) return;
      // Clique simples (um só dia) ou sem permissão → lista os eventos do dia.
      if (lo === hi || !canManageRef.current) {
        onDayClickRef.current(ymd(startD));
        return;
      }
      // Arrasto por vários dias → um evento contínuo (do 1.º ao último dia).
      onCreateRef.current({
        start: atTime(startD, START_HOUR, 0),
        end: atTime(endD, END_HOUR, 0),
      });
    }
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, []);

  const byDay = useMemo(() => {
    const map = new Map<string, EventItem[]>();
    for (const ev of events) {
      // Evento de vários dias aparece em cada dia que abrange.
      for (const dayKey of eventDayKeys(ev)) {
        const arr = map.get(dayKey) || [];
        arr.push(ev);
        map.set(dayKey, arr);
      }
    }
    for (const [key, arr] of map) {
      arr.sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));
      map.set(key, collapseSeriesPerDay(arr)); // 1 bloco por série em cada dia
    }
    return map;
  }, [events]);

  const MAX = kiosk ? 4 : 3;

  return (
    <Card className="rounded-2xl overflow-hidden h-full flex flex-col">
      <div className="grid grid-cols-6 bg-slate-50 border-b border-slate-200">
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
      <div className={`grid grid-cols-6 ${kiosk ? "flex-1 grid-rows-6" : ""}`}>
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === month;
          const dStr = ymd(d);
          const isToday = dStr === todayStr;
          const evs = byDay.get(dStr) || [];
          const sel = drag
            ? { lo: Math.min(drag.a, drag.b), hi: Math.max(drag.a, drag.b) }
            : null;
          const selected =
            canManage && !!sel && i >= sel.lo && i <= sel.hi;
          return (
            <div
              key={i}
              onMouseDown={(e) => {
                e.preventDefault();
                setDrag({ a: i, b: i });
              }}
              onMouseEnter={() => {
                const dr = dragRef.current;
                if (dr) setDrag({ a: dr.a, b: i });
              }}
              title={
                canManage
                  ? "Clique para ver eventos · arraste para marcar"
                  : "Clique para ver os eventos do dia"
              }
              className={`min-w-0 overflow-hidden border-b border-l border-slate-100 p-1.5 [&:nth-child(6n)]:border-r-0 cursor-pointer hover:bg-brand-50/40 ${
                kiosk ? "min-h-0" : "min-h-[104px]"
              } ${
                selected
                  ? "bg-brand-100 ring-2 ring-inset ring-brand-400"
                  : inMonth
                  ? "bg-white"
                  : "bg-slate-50/60"
              }`}
            >
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onDayClick(dStr);
                }}
                className={`mb-1 flex items-center justify-center rounded-full transition hover:bg-brand-100 ${
                  kiosk ? "h-8 w-8 text-sm" : "h-6 w-6 text-xs"
                } ${
                  isToday
                    ? "bg-navy text-white font-bold"
                    : inMonth
                    ? "text-slate-600"
                    : "text-slate-300"
                }`}
                title="Ver eventos do dia"
              >
                {d.getDate()}
              </button>
              <div className="space-y-0.5">
                {evs.slice(0, MAX).map((ev) => (
                  <button
                    key={ev.id}
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(ev);
                    }}
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
                    <span className="opacity-80">{spanTimeLabel(ev, dStr)} </span>
                    {ev.title}
                  </button>
                ))}
                {evs.length > MAX && (
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onDayClick(dStr);
                    }}
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
    </Card>
  );
}

/* ------------------------------ MODAL DE CRIAÇÃO -------------------------------- */
function CreateEventModal({
  form,
  setForm,
  rooms,
  onSubmit,
  onClose,
  saving,
  error,
}: {
  form: CForm;
  setForm: React.Dispatch<React.SetStateAction<CForm>>;
  rooms: Room[];
  onSubmit: (e: React.FormEvent) => void;
  onClose: () => void;
  saving: boolean;
  error: string | null;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <form
        onSubmit={onSubmit}
        onClick={(e) => e.stopPropagation()}
        className="bg-white rounded-2xl shadow-xl max-w-md w-full"
      >
        <div className="bg-navy text-white px-5 py-4 font-bold rounded-t-2xl">
          Novo evento
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
              autoFocus
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="input-rg"
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
              className="input-rg"
            >
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
                  const end =
                    form.endAt <= d ? new Date(d.getTime() + 60 * 60000) : form.endAt;
                  setForm({ ...form, startAt: d, endAt: end });
                }}
                showTimeSelect
                timeIntervals={15}
                timeCaption="Hora"
                dateFormat="dd/MM/yyyy HH:mm"
                locale="pt-BR"
                className="input-rg"
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
                dateFormat="dd/MM/yyyy HH:mm"
                locale="pt-BR"
                className="input-rg"
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
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="input-rg"
            />
          </div>
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
                    repeat: e.target.value as Repeat,
                    repeatUntil:
                      e.target.value === "none" ? null : form.repeatUntil,
                  })
                }
                className="input-rg"
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
                  className="input-rg"
                  wrapperClassName="w-full"
                />
              </div>
            )}
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="flex-1"
          >
            Cancelar
          </Button>
          <Button type="submit" variant="navy" disabled={saving} className="flex-1">
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </div>
      </form>
      <style jsx global>{`
        .input-rg {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #cbd5e1;
          padding: 0.5rem 0.75rem;
          outline: none;
          background: white;
          color: #0f172a;
        }
        .input-rg:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px #bfdbfe;
        }
      `}</style>
    </div>
  );
}

/* --------------------------- MODAL: EVENTOS DO DIA ------------------------------ */
function DayEventsModal({
  dayStr,
  events,
  onSelect,
  onClose,
  canManage,
  onCreateDay,
}: {
  dayStr: string;
  events: EventItem[];
  onSelect: (e: EventItem) => void;
  onClose: () => void;
  canManage: boolean;
  onCreateDay: () => void;
}) {
  // Eventos que tocam este dia (inclui os de vários dias), ordenados por início,
  // com as séries colapsadas a um bloco por série.
  const list = collapseSeriesPerDay(
    events
      .filter((ev) => eventDayKeys(ev).includes(dayStr))
      .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt))
  );
  const title = new Date(`${dayStr}T12:00:00`).toLocaleDateString("pt-PT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  return (
    <div
      className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-navy text-white px-5 py-4 flex items-center justify-between gap-3">
          <h3 className="font-bold text-lg capitalize">{title}</h3>
          <span className="text-brand-200 text-sm shrink-0">
            {list.length} evento(s)
          </span>
        </div>
        <div className="p-5 space-y-2 max-h-[60vh] overflow-auto">
          {list.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-4">
              Sem eventos neste dia.
            </p>
          ) : (
            list.map((ev) => (
              <button
                key={ev.id}
                onClick={() => onSelect(ev)}
                className="w-full text-left rounded-lg border border-slate-200 hover:bg-slate-50 px-3 py-2 flex items-center gap-3 transition"
              >
                <span
                  className="inline-block h-3 w-3 rounded-full shrink-0"
                  style={{ background: ev.room.color }}
                />
                <span className="flex-1 min-w-0">
                  <span className="block font-semibold text-slate-800 truncate">
                    {ev.title}
                  </span>
                  <span className="block text-xs text-slate-500 truncate">
                    {eventRangeLabel(ev)} · {ev.room.name}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
        <div className="px-5 pb-5 flex gap-2">
          {canManage && (
            <Button
              type="button"
              variant="navy"
              className="flex-1"
              onClick={onCreateDay}
            >
              <Plus className="h-4 w-4" /> Novo neste dia
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Fechar
          </Button>
        </div>
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
          <Button variant="secondary" onClick={onClose} className="w-full">
            Fechar
          </Button>
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
