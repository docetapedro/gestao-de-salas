import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

/**
 * GET /api/indicadores/base
 * Lista base dos indicadores (para os dropdowns). Porta `listarBase()`.
 */
export async function GET() {
  try {
    assertCan(await getSession(), "indicadores", "view");
    const indicadores = await prisma.indicador.findMany({
      orderBy: { titulo: "asc" },
      select: {
        id: true,
        titulo: true,
        tipoGrafico: true,
        limite: true,
        detalhes: true,
        temFilhos: true,
      },
    });
    return json({ indicadores });
  } catch (err) {
    return handleError(err);
  }
}
