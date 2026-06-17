import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertAuthenticated, assertCanManage } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";
import { findConflict } from "@/lib/events";
import { randomUUID } from "crypto";

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

    const description = body.description ? String(body.description).trim() : null;
    const repeat: string = body.repeat || "none";

    // --- Evento único ---
    if (repeat === "none") {
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
        data: { title, description, roomId, startAt, endAt, createdById: session.sub },
        include: { room: { select: { id: true, name: true, color: true } } },
      });
      return json({ event }, 201);
    }

    // --- Evento recorrente (agendamento periódico) ---
    if (!["daily", "weekly", "monthly"].includes(repeat)) {
      return json({ error: "Tipo de repetição inválido" }, 400);
    }
    const until = body.repeatUntil ? new Date(body.repeatUntil) : null;
    if (!until || isNaN(until.getTime())) {
      return json({ error: "Informe a data limite da repetição" }, 400);
    }
    until.setHours(23, 59, 59, 999);
    if (until.getTime() < startAt.getTime()) {
      return json({ error: "A data limite deve ser depois do início" }, 400);
    }

    const occ = buildOccurrences(startAt, endAt, repeat, until);
    if (occ.length === 0) {
      return json({ error: "Nenhuma ocorrência no período informado" }, 400);
    }

    const seriesId = randomUUID();
    const toCreate = [];
    let skipped = 0;
    for (const o of occ) {
      const conflict = await findConflict(roomId, o.start, o.end);
      if (conflict) {
        skipped++;
        continue;
      }
      toCreate.push({
        title,
        description,
        roomId,
        startAt: o.start,
        endAt: o.end,
        createdById: session.sub,
        seriesId,
      });
    }
    if (toCreate.length > 0) {
      await prisma.event.createMany({ data: toCreate });
    }
    return json(
      { created: toCreate.length, skipped, total: occ.length, seriesId },
      201
    );
  } catch (err) {
    return handleError(err);
  }
}

// Soma n meses preservando o dia (com clamp para meses mais curtos).
function addMonthsKeepDay(base: Date, n: number): Date {
  const d = new Date(base.getFullYear(), base.getMonth(), 1);
  d.setMonth(d.getMonth() + n);
  const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(base.getDate(), daysInMonth));
  d.setHours(base.getHours(), base.getMinutes(), 0, 0);
  return d;
}

// Gera as ocorrências de uma série até a data limite (máx. 366).
function buildOccurrences(
  start: Date,
  end: Date,
  repeat: string,
  until: Date
): { start: Date; end: Date }[] {
  const durMs = end.getTime() - start.getTime();
  const out: { start: Date; end: Date }[] = [];
  const MAX = 366;
  for (let i = 0; i < MAX; i++) {
    let s: Date;
    if (repeat === "daily") {
      s = new Date(start);
      s.setDate(start.getDate() + i);
    } else if (repeat === "weekly") {
      s = new Date(start);
      s.setDate(start.getDate() + i * 7);
    } else {
      s = addMonthsKeepDay(start, i);
    }
    if (s.getTime() > until.getTime()) break;
    if (repeat === "daily" && s.getDay() === 0) continue; // pula domingo
    out.push({ start: s, end: new Date(s.getTime() + durMs) });
  }
  return out;
}
