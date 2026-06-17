import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertAuthenticated, assertCanManage } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";
import { findConflict } from "@/lib/events";

export async function GET(req: NextRequest) {
  try {
    assertAuthenticated(await getSession());
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

    const include = {
      room: { select: { id: true, name: true, color: true } },
      createdBy: { select: { id: true, name: true } },
    };

    // Paginação opcional: só ativa quando pageSize > 0 (a grade busca tudo).
    const pageSize = Number(searchParams.get("pageSize") || "0");
    if (pageSize > 0) {
      const page = Math.max(1, Number(searchParams.get("page") || "1"));
      const [events, total] = await prisma.$transaction([
        prisma.event.findMany({
          where,
          orderBy: { startAt: "asc" },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include,
        }),
        prisma.event.count({ where }),
      ]);
      return json({ events, total, page, pageSize });
    }

    const events = await prisma.event.findMany({
      where,
      orderBy: { startAt: "asc" },
      include,
    });
    return json({ events });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = assertCanManage(await getSession());
    const body = await req.json();

    const title = String(body.title || "").trim();
    const roomId = String(body.roomId || "");
    const startAt = body.startAt ? new Date(body.startAt) : null;
    const endAt = body.endAt ? new Date(body.endAt) : null;

    if (!title) return json({ error: "Título é obrigatório" }, 400);
    if (!roomId) return json({ error: "Sala é obrigatória" }, 400);
    if (!startAt || isNaN(startAt.getTime()))
      return json({ error: "Data/hora de início inválida" }, 400);
    if (!endAt || isNaN(endAt.getTime()))
      return json({ error: "Data/hora de fim inválida" }, 400);
    if (endAt <= startAt)
      return json({ error: "O fim deve ser depois do início" }, 400);

    const conflict = await findConflict(roomId, startAt, endAt);
    if (conflict) {
      return json(
        {
          error: `Conflito com o evento "${conflict.title}" nesta sala nesse horário`,
        },
        409
      );
    }

    const event = await prisma.event.create({
      data: {
        title,
        description: body.description ? String(body.description).trim() : null,
        roomId,
        startAt,
        endAt,
        createdById: session.sub,
      },
      include: {
        room: { select: { id: true, name: true, color: true } },
      },
    });
    return json({ event }, 201);
  } catch (err) {
    return handleError(err);
  }
}
