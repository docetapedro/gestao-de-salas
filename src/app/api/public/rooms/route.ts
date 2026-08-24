import { json, handleError } from "@/lib/http";
import { getSalasPublicasCached } from "@/lib/agenda-cache";

// Leitura pública (sem sessão) das salas — usada pela agenda pública.
// Servida do Data Cache; só toca no Neon quando o cache é invalidado.
export async function GET() {
  try {
    const rooms = await getSalasPublicasCached();
    return json({ rooms });
  } catch (err) {
    return handleError(err);
  }
}
