import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { json, handleError } from "@/lib/http";
import { normalizarCodigo } from "@/lib/tesouro-payload";

type Params = { params: Promise<{ id: string }> };

/**
 * Leitura pública (sem login) de um baú para jogar via QR Code.
 * NUNCA devolve os códigos dos cartões (a chave) — só o nº de blocos e o
 * tamanho de cada um (+ etiqueta como pista). Indica se já foi aberto e por quem.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const dinamica = await prisma.dinamica.findUnique({
      where: { id },
      include: {
        evento: { select: { nome: true, local: true } },
        tesouroVencedor: { select: { id: true, nome: true, cor: true } },
        cartoesTesouro: {
          orderBy: { createdAt: "asc" },
          select: { codigo: true, etiqueta: true },
        },
      },
    });

    if (!dinamica || dinamica.tipo !== "tesouro") {
      return json({ error: "Baú não encontrado" }, 404);
    }

    const equipas = await prisma.equipa.findMany({
      where: { eventoId: dinamica.eventoId },
      orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
      select: { id: true, nome: true, cor: true },
    });

    return json({
      tesouro: {
        id: dinamica.id,
        nome: dinamica.nome,
        descricao: dinamica.descricao,
        evento: dinamica.evento,
        aberto: dinamica.tesouroVencedorEquipaId != null,
        vencedor: dinamica.tesouroVencedor,
        // Só metadados dos blocos — sem revelar a chave.
        blocos: dinamica.cartoesTesouro.map((c) => ({
          tamanho: normalizarCodigo(c.codigo).length,
          etiqueta: c.etiqueta,
        })),
      },
      equipas,
    });
  } catch (err) {
    return handleError(err);
  }
}
