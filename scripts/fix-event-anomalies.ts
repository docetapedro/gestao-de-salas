/*
 * Corrige anomalias de eventos em produção.
 *
 *   1) Duplicados EXATOS  — mesma sala, título, descrição, início e fim.
 *      Mantém o mais antigo (createdAt) e remove os restantes.
 *   2) Sobreposições       — eventos da mesma sala cujos horários se cruzam
 *      (sem serem duplicados exatos). SÓ são reportados — nunca removidos
 *      automaticamente, porque exigem decisão manual sobre qual manter.
 *
 * Uso:
 *   Relatório (não altera nada):
 *     npx tsx scripts/fix-event-anomalies.ts
 *   Aplicar (remove os duplicados exatos):
 *     npx tsx scripts/fix-event-anomalies.ts --apply
 *
 * Requer DATABASE_URL de PRODUÇÃO e o cliente Prisma do Postgres
 * (se necessário: prisma generate --schema prisma/schema.prisma).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

function fmt(d: Date): string {
  return d.toISOString().slice(0, 16).replace("T", " ");
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
