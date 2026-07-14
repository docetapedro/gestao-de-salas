import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertAuthenticated, assertCanManage } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";
import {
  projectScalars,
  formadoresCreate,
  participantesCreate,
  turmasCreate,
  nextProjectCodigo,
} from "./_shared";

export async function GET() {
  try {
    assertAuthenticated(await getSession());
    const rows = await prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        pilar: true,
        local: true,
        cliente: true,
        participantes: { select: { quantidade: true } },
      },
    });
    // "Inscritos" = soma das quantidades dos grupos de participantes.
    const projetos = rows.map(({ participantes, ...p }) => ({
      ...p,
      inscritos: participantes.reduce((sum, x) => sum + (x.quantidade ?? 1), 0),
    }));
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
        codigo: await nextProjectCodigo(),
        createdById: session.sub,
        formadores: { create: formadoresCreate(body) },
        participantes: { create: participantesCreate(body) },
        turmas: { create: turmasCreate(body) },
      },
    });
    return json({ projeto }, 201);
  } catch (err) {
    return handleError(err);
  }
}
