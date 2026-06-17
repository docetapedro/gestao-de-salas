import { prisma } from "./prisma";

/** Procura um evento que se sobreponha ao intervalo na mesma sala. */
export async function findConflict(
  roomId: string,
  startAt: Date,
  endAt: Date,
  ignoreId?: string
) {
  return prisma.event.findFirst({
    where: {
      roomId,
      id: ignoreId ? { not: ignoreId } : undefined,
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    select: { id: true, title: true },
  });
}
