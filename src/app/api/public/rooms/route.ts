import { prisma } from "@/lib/prisma";
import { json, handleError } from "@/lib/http";

// Leitura pública (sem sessão) das salas — usada pela agenda pública.
export async function GET() {
  try {
    const rooms = await prisma.room.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, color: true, active: true },
    });
    return json({ rooms });
  } catch (err) {
    return handleError(err);
  }
}
