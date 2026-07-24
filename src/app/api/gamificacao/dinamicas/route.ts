import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { assertCan } from "@/lib/permissions";
import { json, handleError } from "@/lib/http";
import { gravarPerguntas, lerConfigQuiz } from "@/lib/quiz-payload";

export async function POST(req: NextRequest) {
  try {
    assertCan(await getSession(), "gamificacao", "manage");
    const body = await req.json();
    const eventoId = String(body.eventoId || "").trim();
    const nome = String(body.nome || "").trim();
    if (!eventoId) return json({ error: "Evento é obrigatório" }, 400);
    if (!nome) return json({ error: "Nome da dinâmica é obrigatório" }, 400);

    const ultima = await prisma.dinamica.findFirst({
      where: { eventoId },
      orderBy: { ordem: "desc" },
      select: { ordem: true },
    });
    const peso = Number(body.peso);
    const tipo = body.tipo === "quiz" ? "quiz" : "manual";
    const cfg = lerConfigQuiz(body);

    const dinamica = await prisma.dinamica.create({
      data: {
        eventoId,
        nome,
        descricao: body.descricao ? String(body.descricao).trim() : null,
        peso: Number.isFinite(peso) && peso > 0 ? peso : 1,
        ordem: (ultima?.ordem ?? -1) + 1,
        tipo,
        ...cfg,
      },
    });

    if (tipo === "quiz") {
      await gravarPerguntas(dinamica.id, body.perguntas);
    }

    return json({ dinamica }, 201);
  } catch (err) {
    return handleError(err);
  }
}
