/*
 * Corrige anomalias de eventos em produção.
 *
 *   1) Duplicados EXATOS  — mesma sala, título, descrição, início e fim.
 *      Mantém o mais antigo (createdAt) e remove os restantes.
 *   2) Sobreposições       — eventos da mesma sala cujos horários se cruzam
 *      (sem serem duplicados exatos). SÓ são reportados — nunca removidos
 *      automaticamente, porque exigem decisão manual sobre qual manter.
 *   3) Blocos contínuos multi-dia — evento ÚNICO (sem seriesId) cujo início e
 *      fim caem em dias diferentes. Ocupa a sala ininterruptamente (noites
 *      incluídas) e gera falsos conflitos com eventos no horário livre dos dias
 *      do meio. Com --split-multiday converte-os numa série DIÁRIA: 1 bloco por
 *      dia (seg–sáb) só no horário indicado — a mesma regra que a app já aplica
 *      a novos eventos.
 *
 * Uso:
 *   Relatório (não altera nada):
 *     npx tsx scripts/fix-event-anomalies.ts
 *   Aplicar (remove os duplicados exatos):
 *     npx tsx scripts/fix-event-anomalies.ts --apply
 *   Converter blocos contínuos multi-dia em séries diárias:
 *     npx tsx scripts/fix-event-anomalies.ts --split-multiday --apply
 *   (sem --apply, --split-multiday apenas mostra o plano de conversão)
 *
 * Requer DATABASE_URL de PRODUÇÃO e o cliente Prisma do Postgres
 * (se necessário: prisma generate --schema prisma/schema.prisma).
 */
import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");
const SPLIT = process.argv.includes("--split-multiday");

function fmt(d: Date): string {
  return d.toISOString().slice(0, 16).replace("T", " ");
}

// A app opera no fuso de Angola (UTC+1, sem horário de verão). Para extrair o
// dia/hora "de parede" e reconstruir instantes por dia usamos esse desvio fixo.
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
  const events = await prisma.event.findMany({
    orderBy: [{ roomId: "asc" }, { startAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      roomId: true,
      title: true,
      description: true,
      startAt: true,
      endAt: true,
      createdAt: true,
      createdById: true,
      seriesId: true,
      room: { select: { name: true } },
    },
  });
  type Ev = (typeof events)[number];

  console.log(`Modo: ${APPLY ? "APPLY (vai remover duplicados)" : "DRY-RUN (só relatório)"}`);
  console.log(`Total de eventos: ${events.length}\n`);

  /* 1) Duplicados exatos ---------------------------------------------------- */
  const groups = new Map<string, Ev[]>();
  for (const e of events) {
    const key = [
      e.roomId,
      e.title,
      e.description ?? "",
      e.startAt.toISOString(),
      e.endAt.toISOString(),
    ].join("|");
    const arr = groups.get(key) ?? [];
    arr.push(e);
    groups.set(key, arr);
  }

  const toDelete: { ev: Ev; keptId: string }[] = [];
  let dupGroups = 0;
  for (const arr of groups.values()) {
    if (arr.length > 1) {
      dupGroups++;
      const [keep, ...rest] = arr; // ordenado por createdAt → mantém o mais antigo
      for (const r of rest) toDelete.push({ ev: r, keptId: keep.id });
    }
  }

  console.log(`== Duplicados exatos ==`);
  console.log(
    `Grupos com repetições: ${dupGroups} · eventos a remover: ${toDelete.length}`
  );
  for (const { ev, keptId } of toDelete.slice(0, 60)) {
    console.log(
      `  [remover ${ev.id}] ${ev.room.name} · "${ev.title}" ${fmt(
        ev.startAt
      )}–${fmt(ev.endAt)}  (mantém ${keptId})`
    );
  }
  if (toDelete.length > 60) console.log(`  … +${toDelete.length - 60} mais`);

  /* 2) Sobreposições (após dedupe) ----------------------------------------- */
  const delIds = new Set(toDelete.map((d) => d.ev.id));
  const remaining = events.filter((e) => !delIds.has(e.id));

  const byRoom = new Map<string, Ev[]>();
  for (const e of remaining) {
    const arr = byRoom.get(e.roomId) ?? [];
    arr.push(e);
    byRoom.set(e.roomId, arr);
  }

  const overlaps: [Ev, Ev][] = [];
  for (const arr of byRoom.values()) {
    arr.sort((a, b) => +a.startAt - +b.startAt);
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (+arr[j].startAt >= +arr[i].endAt) break; // ordenado → sem mais cruzamentos
        if (+arr[j].endAt > +arr[i].startAt) overlaps.push([arr[i], arr[j]]);
      }
    }
  }

  console.log(`\n== Sobreposições na mesma sala (após dedupe) ==`);
  console.log(`Pares sobrepostos: ${overlaps.length}  (revisão manual)`);
  for (const [a, b] of overlaps.slice(0, 60)) {
    console.log(
      `  ${a.room.name}:  "${a.title}" ${fmt(a.startAt)}–${fmt(a.endAt)} (${a.id})` +
        `  ✕  "${b.title}" ${fmt(b.startAt)}–${fmt(b.endAt)} (${b.id})`
    );
  }
  if (overlaps.length > 60) console.log(`  … +${overlaps.length - 60} mais`);

  /* 3) Blocos contínuos multi-dia (evento único a atravessar dias) --------- */
  const multi = remaining.filter((e) => {
    if (e.seriesId) return false; // séries já são 1 bloco por dia
    const s = luandaParts(e.startAt);
    const en = luandaParts(e.endAt);
    return s.y !== en.y || s.mo !== en.mo || s.day !== en.day;
  });

  console.log(`\n== Blocos contínuos multi-dia (evento único a atravessar dias) ==`);
  console.log(
    `Encontrados: ${multi.length}` +
      (SPLIT
        ? APPLY
          ? "  (a converter em série diária)"
          : "  (--split-multiday sem --apply → só plano)"
        : "  (usa --split-multiday para converter em série diária)")
  );

  let converted = 0;
  for (const e of multi) {
    const s = luandaParts(e.startAt);
    const en = luandaParts(e.endAt);
    const startTOD = s.h * 60 + s.mi;
    const endTOD = en.h * 60 + en.mi;
    const header = `  ${e.room.name}: "${e.title}" ${fmt(e.startAt)}–${fmt(e.endAt)} (${e.id})`;

    if (endTOD <= startTOD) {
      console.log(`${header}\n      [MANUAL] hora de fim ≤ início — não dá para dividir por dia`);
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
          start: luandaInstant(dd.getUTCFullYear(), dd.getUTCMonth(), dd.getUTCDate(), s.h, s.mi),
          end: luandaInstant(dd.getUTCFullYear(), dd.getUTCMonth(), dd.getUTCDate(), en.h, en.mi),
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

    console.log(
      `${header}\n      → ${kept.length} dia(s) ${fmt(kept[0]?.start ?? e.startAt).slice(11)}–${fmt(
        kept[0]?.end ?? e.endAt
      ).slice(11)}` + (skippedDays ? `  (${skippedDays} dia(s) ignorado(s) por conflito)` : "")
    );

    if (SPLIT && APPLY) {
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
    }
  }
  if (SPLIT && APPLY) {
    console.log(`\n✔ Convertidos ${converted} bloco(s) contínuo(s) em série diária.`);
  } else if (multi.length > 0 && !SPLIT) {
    console.log(`\n(Para converter: corre com --split-multiday --apply)`);
  }

  /* Aplicação --------------------------------------------------------------- */
  if (!toDelete.length) {
    console.log(`\nSem duplicados exatos para remover.`);
  } else if (APPLY) {
    const ids = toDelete.map((d) => d.ev.id);
    let removed = 0;
    for (let i = 0; i < ids.length; i += 500) {
      const batch = ids.slice(i, i + 500);
      const r = await prisma.event.deleteMany({ where: { id: { in: batch } } });
      removed += r.count;
    }
    console.log(`\n✔ Removidos ${removed} duplicados exatos.`);
  } else {
    console.log(
      `\n(DRY-RUN) Nada foi alterado. Corre com --apply para remover os ${toDelete.length} duplicados exatos.`
    );
  }

  if (overlaps.length) {
    console.log(
      `\nNota: as ${overlaps.length} sobreposições não-idênticas NÃO foram tocadas — decide manualmente qual manter (edita/apaga na app).`
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
