import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertAuthenticated, assertCanManage } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";
import { calcularIndicadores } from "@/lib/projetos";
import {
  projectScalars,
  formadoresCreate,
  participantesCreate,
  financeiroCreate,
  projectInclude,
} from "../_shared";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    assertAuthenticated(await getSession());
    const { id } = await params;
    const projeto = await prisma.project.findUnique({
      where: { id },
      include: projectInclude,
    });
    if (!projeto) return json({ error: "Projecto não encontrado" }, 404);
    const indicadores = calcularIndicadores(projeto);
    return json({ projeto, indicadores });
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    assertCanManage(await getSession());
    const { id } = await params;
    const body = await req.json();
    const scalars = projectScalars(body);
    if (!scalars.nome) return json({ error: "Nome do projecto é obrigatório" }, 400);

    // Substitui as colecções-filho por completo (abordagem simples e previsível).
    const projeto = await prisma.$transaction(async (tx) => {
      await tx.projectFormador.deleteMany({ where: { projectId: id } });
      await tx.participante.deleteMany({ where: { projectId: id } });
      await tx.financeiroItem.deleteMany({ where: { projectId: id } });
      return tx.project.update({
        where: { id },
        data: {
          ...scalars,
          formadores: { create: formadoresCreate(body) },
          participantes: { create: participantesCreate(body) },
          financeiro: { create: financeiroCreate(body) },
        },
      });
    });
    return json({ projeto });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    assertCanManage(await getSession());
    const { id } = await params;
    await prisma.project.delete({ where: { id } });
    return json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
