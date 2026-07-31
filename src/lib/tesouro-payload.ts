import { prisma } from "@/lib/prisma";

// Utilitários da dinâmica "Caça ao Tesouro": normalizar códigos e gravar
// (replace-all) os cartões de um baú a partir do payload do editor.

/** Normaliza um código: maiúsculas, sem espaços. */
export function normalizarCodigo(v: unknown): string {
  return String(v ?? "")
    .toUpperCase()
    .replace(/\s+/g, "");
}

type CartaoIn = { codigo?: unknown; etiqueta?: unknown; equipaId?: unknown };

/**
 * Substitui o conjunto de cartões de uma dinâmica pelos do payload. Faz upsert
 * por (dinamicaId, codigo) para **preservar o progresso** (`introduzidoEm`) dos
 * códigos que se mantêm, e apaga os que deixaram de existir. Ignora códigos
 * vazios e valida o envelope (`equipaId`) contra as equipas do evento.
 */
export async function gravarCartoes(
  dinamicaId: string,
  cartoes: unknown
): Promise<void> {
  const lista = Array.isArray(cartoes) ? (cartoes as CartaoIn[]) : [];

  // Equipas válidas do evento desta dinâmica (para validar o envelope).
  const dinamica = await prisma.dinamica.findUnique({
    where: { id: dinamicaId },
    select: { eventoId: true },
  });
  const equipasValidas = new Set<string>();
  if (dinamica) {
    const eqs = await prisma.equipa.findMany({
      where: { eventoId: dinamica.eventoId },
      select: { id: true },
    });
    for (const e of eqs) equipasValidas.add(e.id);
  }

  // Normaliza + remove duplicados por código (o último ganha).
  const porCodigo = new Map<
    string,
    { codigo: string; etiqueta: string | null; equipaId: string | null }
  >();
  for (const c of lista) {
    const codigo = normalizarCodigo(c?.codigo);
    if (!codigo) continue;
    const etiqueta = String(c?.etiqueta ?? "").trim() || null;
    const eqRaw = String(c?.equipaId ?? "").trim();
    const equipaId = eqRaw && equipasValidas.has(eqRaw) ? eqRaw : null;
    porCodigo.set(codigo, { codigo, etiqueta, equipaId });
  }
  const finais = [...porCodigo.values()];
  const codigos = finais.map((c) => c.codigo);

  // Sem cartões: limpa tudo.
  if (finais.length === 0) {
    await prisma.tesouroCartao.deleteMany({ where: { dinamicaId } });
    return;
  }

  const ops = [
    prisma.tesouroCartao.deleteMany({
      where: { dinamicaId, codigo: { notIn: codigos } },
    }),
    ...finais.map((c) =>
      prisma.tesouroCartao.upsert({
        where: { dinamicaId_codigo: { dinamicaId, codigo: c.codigo } },
        create: {
          dinamicaId,
          codigo: c.codigo,
          etiqueta: c.etiqueta,
          equipaId: c.equipaId,
        },
        update: { etiqueta: c.etiqueta, equipaId: c.equipaId },
      })
    ),
  ];

  await prisma.$transaction(ops);
}
