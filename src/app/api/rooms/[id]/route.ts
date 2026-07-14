import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "salas", "manage");
    const { id } = await params;
    const body = await req.json();

    const room = await prisma.room.update({
      where: { id },
      data: {
        name: body.name !== undefined ? String(body.name).trim() : undefined,
        location:
          body.location !== undefined
            ? body.location
              ? String(body.location).trim()
              : null
            : undefined,
        capacity:
          body.capacity !== undefined
            ? body.capacity
              ? Number(body.capacity)
              : null
            : undefined,
        color: body.color !== undefined ? String(body.color) : undefined,
        active: body.active !== undefined ? Boolean(body.active) : undefined,
      },
    });
    return json({ room });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "salas", "manage");
    const { id } = await params;
    await prisma.room.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
