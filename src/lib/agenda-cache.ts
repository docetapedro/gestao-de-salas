import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * Cache da agenda pública (ecrã da entrada da Academia). As leituras públicas
 * são servidas do Data Cache do Vercel — não tocam no Neon enquanto nada muda.
 * As rotas de mutação chamam revalidateTag(TAGS.*) para invalidar (ver abaixo),
 * o que faz a próxima leitura recarregar do Neon uma única vez.
 */
export const TAGS = {
  events: "agenda-events",
  rooms: "agenda-rooms",
} as const;

// Salas activas (agenda pública). Tag: rooms.
export const getSalasPublicasCached = unstable_cache(
  async () =>
    prisma.room.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true, active: true },
    }),
  ["public-rooms"],
  { tags: [TAGS.rooms] }
);

// Eventos que tocam o intervalo [from, to] (agenda pública). Os argumentos
// entram na chave do cache, por isso cada dia/sala é cacheado à parte.
// Tag: events + rooms (os eventos incluem nome/cor da sala).
export const getEventosPublicosCached = unstable_cache(
  async (from: string | null, to: string | null, roomId: string | null) => {
    const where: Record<string, unknown> = {};
    if (roomId) where.roomId = roomId;
    if (from || to) {
      where.AND = [
        from ? { endAt: { gte: new Date(from) } } : {},
        to ? { startAt: { lte: new Date(to) } } : {},
      ];
    }
    return prisma.event.findMany({
      where,
      orderBy: { startAt: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        startAt: true,
        endAt: true,
        room: { select: { id: true, name: true, color: true } },
      },
    });
  },
  ["public-events"],
  { tags: [TAGS.events, TAGS.rooms] }
);
