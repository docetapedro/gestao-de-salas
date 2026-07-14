import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";
import { findConflict } from "@/lib/events";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "eventos", "manage");
    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) return json({ error: "Evento não encontrado" }, 404);

    const roomId = body.roomId ? String(body.roomId) : existing.roomId;
    const startAt = body.startAt ? new Date(body.startAt) : existing.startAt;
    const endAt = body.endAt ? new Date(body.endAt) : existing.endAt;

    if (isNaN(startAt.getTime()) || isNaN(endAt.getTime()))
      return json({ error: "Datas inválidas" }, 400);
    if (endAt <= startAt)
      return json({ error: "O fim deve ser depois do início" }, 400);

    const conflict = await findConflict(roomId, startAt, endAt, id);
    if (conflict) {
      return json(
        { error: `Conflito com o evento "${conflict.title}" nesta sala` },
        409
      );
    }

    // Se mudou o horário de início, reabilita o aviso por email.
    const startChanged = startAt.getTime() !== existing.startAt.getTime();

    const event = await prisma.event.update({
      where: { id },
      data: {
        title: body.title !== undefined ? String(body.title).trim() : undefined,
        description:
          body.description !== undefined
            ? body.description
              ? String(body.description).trim()
              : null
            : undefined,
        roomId,
        startAt,
        endAt,
        notifiedAt: startChanged ? null : undefined,
      },
      include: {
        room: { select: { id: true, name: true, color: true } },
      },
    });
    return json({ event });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "eventos", "manage");
    const { id } = await params;
    const series = new URL(req.url).searchParams.get("series");

    // Excluir a série inteira (todas as ocorrências com o mesmo seriesId).
    if (series === "1" || series === "true") {
      const ev = await prisma.event.findUnique({
        where: { id },
        select: { seriesId: true },
      });
      if (ev?.seriesId) {
        const r = await prisma.event.deleteMany({
          where: { seriesId: ev.seriesId },
        });
        return json({ ok: true, deleted: r.count });
      }
    }

    await prisma.event.delete({ where: { id } });
    return json({ ok: true, deleted: 1 });
  } catch (err) {
    return handleError(err);
  }
}
