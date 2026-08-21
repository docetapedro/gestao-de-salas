import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";

type Params = { params: Promise<{ id: string }> };

function str(v: unknown): string | null {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

// Actualiza os dados do colaborador (master partilhado entre anos).
export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    assertCan(await getSession(), "plano-formativo", "manage");
    const { id } = await params;
    const body = await req.json();

    const nome = str(body.nome);
    if (body.nome !== undefined && !nome)
      return json({ error: "O nome é obrigatório" }, 400);

    const colaborador = await prisma.colaborador.update({
      where: { id },
      data: {
        nome: body.nome !== undefined ? nome! : undefined,
        funcao: body.funcao !== undefined ? str(body.funcao) : undefined,
        direcao: body.direcao !== undefined ? str(body.direcao) : undefined,
        area: body.area !== undefined ? str(body.area) : undefined,
        liderancaDirecta:
          body.liderancaDirecta !== undefined ? str(body.liderancaDirecta) : undefined,
      },
    });
    return json({ colaborador });
  } catch (err) {
    return handleError(err);
  }
}
