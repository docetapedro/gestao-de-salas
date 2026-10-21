// Converte EVENTOS únicos (sem seriesId) cujo início e fim caem em dias
// diferentes num bloco contínuo — que ocupava a sala também nas noites e
// bloqueava o período inteiro, gerando falsos conflitos no horário livre dos
// dias do meio (ex.: "Excel Intermédio" 19→23/10 14:00–17:00 contínuo bloqueava
// 22/10 08:00–12:00). Converte cada um numa SÉRIE DIÁRIA: 1 bloco por dia
// (seg–sáb) só no horário indicado — a mesma regra que a API já aplica a
// eventos novos.
//
// Corre no build (após o `prisma db push`). Idempotente: depois de convertidos,
// os eventos ganham seriesId e deixam de ser reprocessados; sem blocos
// multi-dia por converter não altera nada. Numa BD nova a tabela ainda não
// existe — nesse caso ignora.
//
// Uso: tsx prisma/backfill-split-multiday-events.ts
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();

function fmt(d: Date): string {
  return d.toISOString().slice(0, 16).replace("T", " ");
}

// A app opera no fuso de Angola (UTC+1, sem horário de verão). Fatiamos os dias
// e reconstruímos os instantes por dia com esse desvio fixo.
const LUANDA_OFFSET_MS = 3600_000;
function luandaParts(d: Date) {
  const u = new Date(d.getTime() + LUANDA_OFFSET_MS);
  return {
    y: u.getUTCFullYear(),
    mo: u.getUTCMonth(),
    day: u.getUTCDate(),
    h: u.getUTCHours(),
    mi: u.getUTCMinutes(),
  };
}
function luandaInstant(
  y: number,
  mo: number,
  day: number,
  h: number,
  mi: number
): Date {
  return new Date(Date.UTC(y, mo, day, h, mi) - LUANDA_OFFSET_MS);
}

async function main() {
  let events;
  try {
    events = await prisma.event.findMany({
      orderBy: [{ roomId: "asc" }, { startAt: "asc" }],
      select: {
        id: true,
        roomId: true,
        title: true,
        description: true,
        startAt: true,
        endAt: true,
        createdById: true,
        seriesId: true,
        room: { select: { name: true } },
      },
    });
  } catch (e: any) {
    if (e?.code === "P2021") {
      console.log(
        "[split-multiday] tabela Event ainda não existe — ignorado (BD nova)."
      );
      return;
    }
    throw e;
  }
  type Ev = (typeof events)[number];

  // Índice por sala, para não recriar dias que colidam com OUTROS eventos.
  const byRoom = new Map<string, Ev[]>();
  for (const e of events) {
    const arr = byRoom.get(e.roomId) ?? [];
    arr.push(e);
    byRoom.set(e.roomId, arr);
  }

  // Blocos contínuos multi-dia: evento único (sem série) a atravessar dias.
  const multi = events.filter((e) => {
    if (e.seriesId) return false;
    const s = luandaParts(e.startAt);
    const en = luandaParts(e.endAt);
    return s.y !== en.y || s.mo !== en.mo || s.day !== en.day;
  });

  if (multi.length === 0) {
    console.log("[split-multiday] nada a converter.");
    return;
  }

  let converted = 0;
  let manual = 0;
  for (const e of multi) {
    const s = luandaParts(e.startAt);
    const en = luandaParts(e.endAt);
    const startTOD = s.h * 60 + s.mi;
    const endTOD = en.h * 60 + en.mi;
    const header = `[split-multiday] ${e.room.name}: "${e.title}" ${fmt(
      e.startAt
    )}–${fmt(e.endAt)} (${e.id})`;

    if (endTOD <= startTOD) {
      // Atravessa a meia-noite — não dá para dividir em blocos diários; deixa
      // como está para decisão manual.
      console.log(`${header}: [MANUAL] hora de fim ≤ início — não convertido.`);
      manual++;
      continue;
    }

    // Uma ocorrência por dia (seg–sáb), do dia de início ao dia de fim.
    const occ: { start: Date; end: Date }[] = [];
    let cur = Date.UTC(s.y, s.mo, s.day);
    const lastUTC = Date.UTC(en.y, en.mo, en.day);
    while (cur <= lastUTC) {
      const dd = new Date(cur);
      if (dd.getUTCDay() !== 0) {
        // pula domingo
        occ.push({
          start: luandaInstant(
            dd.getUTCFullYear(),
            dd.getUTCMonth(),
            dd.getUTCDate(),
            s.h,
            s.mi
          ),
          end: luandaInstant(
            dd.getUTCFullYear(),
            dd.getUTCMonth(),
            dd.getUTCDate(),
            en.h,
            en.mi
          ),
        });
      }
      cur += 86_400_000; // +1 dia (UTC não tem DST)
    }

    // Não recria dias que colidam com OUTROS eventos da mesma sala.
    const others = (byRoom.get(e.roomId) ?? []).filter((o) => o.id !== e.id);
    const kept = occ.filter(
      (o) => !others.some((x) => +x.startAt < +o.end && +x.endAt > +o.start)
    );
    const skippedDays = occ.length - kept.length;

    const seriesId = randomUUID();
    await prisma.$transaction(async (tx) => {
      await tx.event.delete({ where: { id: e.id } });
      if (kept.length > 0) {
        await tx.event.createMany({
          data: kept.map((o) => ({
            title: e.title,
            description: e.description,
            roomId: e.roomId,
            startAt: o.start,
            endAt: o.end,
            createdById: e.createdById ?? null,
            seriesId,
          })),
        });
      }
    });
    converted++;
    console.log(
      `${header}: → ${kept.length} bloco(s) diário(s)` +
        (skippedDays ? ` (${skippedDays} dia(s) ignorado(s) por conflito)` : "")
    );
  }

  console.log(
    `[split-multiday] concluído: ${converted} bloco(s) convertido(s) em série diária` +
      (manual ? `; ${manual} para rever manualmente.` : ".")
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
