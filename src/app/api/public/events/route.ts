import { NextRequest } from "next/server";
import { json, handleError } from "@/lib/http";
import { getEventosPublicosCached } from "@/lib/agenda-cache";

// Leitura pública (sem sessão) dos eventos num intervalo — usada pela agenda
// pública. Servida do Data Cache; só toca no Neon quando o cache é invalidado.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const roomId = searchParams.get("roomId");

    const events = await getEventosPublicosCached(from, to, roomId);
    return json({ events });
  } catch (err) {
    return handleError(err);
  }
}
