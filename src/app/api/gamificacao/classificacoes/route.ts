import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

type Lancamento = { dinamicaId: string; equipaId: string; pontos: number };

/**
 * Lança/actualiza pontuações em lote (upsert por dinâmica+equipa).
 * Body: { lancamentos: [{ dinamicaId, equipaId, pontos }] }
 */
export async function POST(req: NextRequest) {
  try {
    assertCan(await getSession(), "gamificacao", "manage");
    const body = await req.json();
    const brutos = Array.isArray(body.lancamentos) ? body.lancamentos : [];

    const lancamentos: Lancamento[] = [];
    for (const l of brutos) {
      const dinamicaId = String(l?.dinamicaId || "").trim();
      const equipaId = String(l?.equipaId || "").trim();
      if (!dinamicaId || !equipaId) continue;
      const p = Number(l?.pontos);
      lancamentos.push({
        dinamicaId,
        equipaId,
        pontos: Number.isFinite(p) ? p : 0,
      });
    }

    if (!lancamentos.length) return json({ ok: true, atualizados: 0 });

    await prisma.$transaction(
      lancamentos.map((l) =>
        prisma.classificacao.upsert({
          where: {
            dinamicaId_equipaId: {
              dinamicaId: l.dinamicaId,
              equipaId: l.equipaId,
            },
          },
          create: {
            dinamicaId: l.dinamicaId,
            equipaId: l.equipaId,
            pontos: l.pontos,
          },
          update: { pontos: l.pontos },
        })
      )
    );

    return json({ ok: true, atualizados: lancamentos.length });
  } catch (err) {
    return handleError(err);
  }
}
