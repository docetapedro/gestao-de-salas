import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertAuthenticated, assertCanManage } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

export async function GET() {
  try {
    assertAuthenticated(await getSession());
    const rooms = await prisma.room.findMany({
      orderBy: { name: "asc" },
    });
    return json({ rooms });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    assertCanManage(await getSession());
    const body = await req.json();
    const name = String(body.name || "").trim();
    if (!name) return json({ error: "Nome da sala é obrigatório" }, 400);

    const room = await prisma.room.create({
      data: {
        name,
        location: body.location ? String(body.location).trim() : null,
        capacity: body.capacity ? Number(body.capacity) : null,
        color: body.color ? String(body.color) : "#1d4ed8",
        active: body.active === undefined ? true : Boolean(body.active),
      },
    });
    return json({ room }, 201);
  } catch (err) {
    return handleError(err);
  }
}
