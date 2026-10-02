// Deduplica EVENTOS da agenda que ficaram repetidos/sobrepostos em produção
// (antes de a criação ser atómica).
//
//   - Duplicados EXATOS (mesma sala, título, descrição, início e fim): mantém o
//     mais antigo (createdAt) e apaga os restantes.
//   - Sobreposições na mesma sala que NÃO são duplicados exatos: apenas são
//     reportadas nos logs (exigem decisão manual — nunca apagadas aqui).
//
// Corre no build (após o `prisma db push`). Idempotente: sem duplicados exatos,
// não altera nada. Numa BD nova a tabela ainda não existe — nesse caso ignora.
//
// Uso: tsx prisma/backfill-dedup-events.ts
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function fmt(d: Date): string {
  return d.toISOString().slice(0, 16).replace("T", " ");
}

async function main() {
  let events;
  try {
    events = await prisma.event.findMany({
      orderBy: [{ roomId: "asc" }, { startAt: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        roomId: true,
        title: true,
        description: true,
        startAt: true,
        endAt: true,
        room: { select: { name: true } },
      },
    });
  } catch (e: any) {
    if (e?.code === "P2021") {
      console.log("[dedup-events] tabela Event ainda não existe — ignorado (BD nova).");
      return;
    }
    throw e;
  }
  type Ev = (typeof events)[number];

  /* 1) Duplicados exatos — agrupa e remove os repetidos, mantendo o mais antigo */
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

  const toDeleteIds: string[] = [];
  for (const arr of groups.values()) {
    if (arr.length < 2) continue;
    const [keep, ...rest] = arr; // ordenado por createdAt → mantém o mais antigo
    console.log(
      `[dedup-events] "${keep.title}" @ ${keep.room.name} ${fmt(keep.startAt)}–${fmt(
        keep.endAt
      )}: mantém ${keep.id}, apaga ${rest.length} duplicado(s)`
    );
    for (const r of rest) toDeleteIds.push(r.id);
  }

  let removed = 0;
  for (let i = 0; i < toDeleteIds.length; i += 500) {
    const batch = toDeleteIds.slice(i, i + 500);
    const r = await prisma.event.deleteMany({ where: { id: { in: batch } } });
    removed += r.count;
  }

  /* 2) Sobreposições restantes (após dedupe) — só reporta */
  const delSet = new Set(toDeleteIds);
  const byRoom = new Map<string, Ev[]>();
  for (const e of events) {
    if (delSet.has(e.id)) continue;
    const arr = byRoom.get(e.roomId) ?? [];
    arr.push(e);
    byRoom.set(e.roomId, arr);
  }

  let overlaps = 0;
  for (const arr of byRoom.values()) {
    arr.sort((a, b) => +a.startAt - +b.startAt);
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        if (+arr[j].startAt >= +arr[i].endAt) break; // ordenado → sem mais cruzamentos
        if (+arr[j].endAt > +arr[i].startAt) {
          overlaps++;
          if (overlaps <= 40) {
            console.log(
              `[dedup-events] SOBREPOSIÇÃO ${arr[i].room.name}: ` +
                `"${arr[i].title}" ${fmt(arr[i].startAt)}–${fmt(arr[i].endAt)} (${arr[i].id})` +
                ` ✕ "${arr[j].title}" ${fmt(arr[j].startAt)}–${fmt(arr[j].endAt)} (${arr[j].id})`
            );
          }
        }
      }
    }
  }

  console.log(
    `[dedup-events] concluído: ${removed} duplicado(s) exato(s) removido(s); ` +
      `${overlaps} par(es) sobreposto(s) não-idêntico(s) para rever manualmente.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
