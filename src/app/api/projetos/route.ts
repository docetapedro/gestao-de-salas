import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertAuthenticated, assertCanManage } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";
import {
  projectScalars,
  formadoresCreate,
  participantesCreate,
  financeiroCreate,
} from "./_shared";

export async function GET() {
  try {
    assertAuthenticated(await getSession());
    const projetos = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        pilar: true,
        local: true,
        cliente: true,
        _count: { select: { participantes: true } },
      },
    });
    return json({ projetos });
  } catch (err) {
    return handleError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = assertCanManage(await getSession());
    const body = await req.json();
    const scalars = projectScalars(body);
    if (!scalars.nome) return json({ error: "Nome do projecto é obrigatório" }, 400);

    const projeto = await prisma.project.create({
      data: {
        ...scalars,
        createdById: session.sub,
        formadores: { create: formadoresCreate(body) },
        participantes: { create: participantesCreate(body) },
        financeiro: { create: financeiroCreate(body) },
      },
    });
    return json({ projeto }, 201);
  } catch (err) {
    return handleError(err);
  }
}
