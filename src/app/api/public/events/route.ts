import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { json, handleError } from "@/lib/http";

// Leitura pública (sem sessão) dos eventos num intervalo — usada pela agenda
// pública. Só devolve os campos necessários para a grade (sem createdBy).
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const roomId = searchParams.get("roomId");

    const where: Record<string, unknown> = {};
    if (roomId) where.roomId = roomId;
    if (from || to) {
      // Eventos que tocam o intervalo [from, to].
      where.AND = [
        from ? { endAt: { gte: new Date(from) } } : {},
        to ? { startAt: { lte: new Date(to) } } : {},
      ];
    }

    const events = await prisma.event.findMany({
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
    return json({ events });
  } catch (err) {
    return handleError(err);
  }
}
