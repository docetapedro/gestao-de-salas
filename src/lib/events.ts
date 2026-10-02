import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

// Lock advisory só existe no Postgres (produção). Em dev (SQLite) é no-op — a
// concorrência local não é um problema e o SQLite serializa escritas.
const IS_POSTGRES = (process.env.DATABASE_URL || "").startsWith("postgres");

type DbClient = Prisma.TransactionClient | typeof prisma;

const roomInclude = {
  room: { select: { id: true, name: true, color: true } },
} as const;

/** Lançado quando um evento colide com outro na mesma sala. */
export class EventConflictError extends Error {
  conflictTitle: string;
  constructor(title: string) {
    super(`Conflito com o evento "${title}" nesta sala nesse horário`);
    this.name = "EventConflictError";
    this.conflictTitle = title;
  }
}

/** Procura um evento que se sobreponha ao intervalo na mesma sala. */
export async function findConflict(
  roomId: string,
  startAt: Date,
  endAt: Date,
  ignoreId?: string,
  client: DbClient = prisma
) {
  return client.event.findFirst({
    where: {
      roomId,
      id: ignoreId ? { not: ignoreId } : undefined,
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    select: { id: true, title: true },
  });
}

// Serializa as escritas da MESMA sala: enquanto uma transação detém o lock da
// sala, nenhuma outra consegue verificar+inserir eventos nessa sala. Assim a
// verificação de conflito e a criação tornam-se atómicas (sem corridas). O lock
// é libertado automaticamente no fim da transação.
async function lockRoom(tx: Prisma.TransactionClient, roomId: string) {
  if (!IS_POSTGRES) return;
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${roomId}))`;
}

type EventCreateInput = {
  title: string;
  description: string | null;
  roomId: string;
  startAt: Date;
  endAt: Date;
  createdById?: string | null;
};

/**
 * Cria um evento único de forma atómica: adquire o lock da sala, verifica
 * conflito e insere na mesma transação. Lança EventConflictError se colidir.
 */
export async function createEvent(data: EventCreateInput) {
  return prisma.$transaction(async (tx) => {
    await lockRoom(tx, data.roomId);
    const conflict = await findConflict(
      data.roomId,
      data.startAt,
      data.endAt,
      undefined,
      tx
    );
    if (conflict) throw new EventConflictError(conflict.title);
    return tx.event.create({ data, include: roomInclude });
  });
}

type EventUpdateInput = {
  roomId: string;
  startAt: Date;
  endAt: Date;
  title?: string;
  description?: string | null;
  notifiedAt?: Date | null;
};

/**
 * Atualiza um evento de forma atómica (lock da sala + verificação de conflito,
 * ignorando o próprio id). Lança EventConflictError se colidir.
 */
export async function updateEvent(id: string, data: EventUpdateInput) {
  return prisma.$transaction(async (tx) => {
    await lockRoom(tx, data.roomId);
    const conflict = await findConflict(
      data.roomId,
      data.startAt,
      data.endAt,
      id,
      tx
    );
    if (conflict) throw new EventConflictError(conflict.title);
    return tx.event.update({ where: { id }, data, include: roomInclude });
  });
}

type Occurrence = { start: Date; end: Date };

/**
 * Cria uma série de ocorrências de forma atómica numa única transação: adquire
 * o lock da sala uma vez, carrega os eventos já existentes que tocam o período
 * (uma só query) e, em memória, salta as ocorrências que colidem — as restantes
 * são inseridas em lote. Devolve a contagem criada e ignorada.
 */
export async function createEventSeries(params: {
  roomId: string;
  title: string;
  description: string | null;
  createdById?: string | null;
  seriesId: string;
  occurrences: Occurrence[];
}) {
  const { roomId, title, description, createdById, seriesId, occurrences } =
    params;
  if (occurrences.length === 0) return { created: 0, skipped: 0 };

  let minStart = occurrences[0].start;
  let maxEnd = occurrences[0].end;
  for (const o of occurrences) {
    if (o.start < minStart) minStart = o.start;
    if (o.end > maxEnd) maxEnd = o.end;
  }

  return prisma.$transaction(async (tx) => {
    await lockRoom(tx, roomId);
    // Um único fetch dos eventos da sala que tocam todo o período da série.
    const existing = await tx.event.findMany({
      where: { roomId, startAt: { lt: maxEnd }, endAt: { gt: minStart } },
      select: { startAt: true, endAt: true },
    });

    const toCreate: Prisma.EventCreateManyInput[] = [];
    let skipped = 0;
    for (const o of occurrences) {
      const clash = existing.some(
        (e) => e.startAt < o.end && e.endAt > o.start
      );
      if (clash) {
        skipped++;
        continue;
      }
      toCreate.push({
        title,
        description,
        roomId,
        startAt: o.start,
        endAt: o.end,
        createdById: createdById ?? null,
        seriesId,
      });
    }
    if (toCreate.length > 0) {
      await tx.event.createMany({ data: toCreate });
    }
    return { created: toCreate.length, skipped };
  });
}
