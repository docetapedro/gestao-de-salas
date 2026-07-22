import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

/** Normaliza a lista de membros (array de nomes ou de {nome}). */
function normMembros(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((m) => (typeof m === "string" ? m : (m as { nome?: string })?.nome))
    .map((n) => String(n || "").trim())
    .filter(Boolean);
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "gamificacao", "manage");
    const { id } = await params;
    const body = await req.json();

    // Se vierem membros, substitui a lista inteira (delete + create) na mesma transacção.
    const substituirMembros = body.membros !== undefined;
    const membros = substituirMembros ? normMembros(body.membros) : [];

    const equipa = await prisma.$transaction(async (tx) => {
      await tx.equipa.update({
        where: { id },
        data: {
          nome: body.nome !== undefined ? String(body.nome).trim() : undefined,
          cor:
            body.cor !== undefined
              ? String(body.cor).trim() || "#2563eb"
              : undefined,
          lema:
            body.lema !== undefined
              ? body.lema
                ? String(body.lema).trim()
                : null
              : undefined,
          ordem:
            body.ordem !== undefined
              ? Math.trunc(Number(body.ordem))
              : undefined,
        },
      });
      if (substituirMembros) {
        await tx.equipaMembro.deleteMany({ where: { equipaId: id } });
        if (membros.length) {
          await tx.equipaMembro.createMany({
            data: membros.map((n) => ({ equipaId: id, nome: n })),
          });
        }
      }
      return tx.equipa.findUnique({
        where: { id },
        include: { membros: { orderBy: { nome: "asc" } } },
      });
    });
    return json({ equipa });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "gamificacao", "manage");
    const { id } = await params;
    await prisma.equipa.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
