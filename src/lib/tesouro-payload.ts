import { prisma } from "@/lib/prisma";

// Utilitários da dinâmica "Caça ao Tesouro": normalizar códigos, gravar
// (replace-all) os cartões de um baú, e a lógica do jogo por equipa
// (validar a chave + registar tentativas + apurar o vencedor).

/** Normaliza um código: maiúsculas, sem espaços. */
export function normalizarCodigo(v: unknown): string {
  return String(v ?? "")
    .toUpperCase()
    .replace(/\s+/g, "");
}

export type ResultadoTentativa = {
  correta: boolean; // a combinação submetida está certa
  venceu: boolean; // esta equipa foi a primeira a abrir (ganhou agora)
  jaAberto: boolean; // o baú já estava aberto (por esta ou outra equipa)
  vencedorEquipaId: string | null;
};

/**
 * Regista uma tentativa de abrir o baú e apura o resultado.
 * A chave correta = concatenação dos códigos dos cartões, pela ordem do editor.
 * O primeiro a acertar ganha (first-wins ATÓMICO via updateMany com guarda
 * `tesouroVencedorEquipaId: null`) e recebe `valorTesouro` pontos.
 */
export async function registarTentativaTesouro(
  dinamicaId: string,
  equipaId: string,
  combinacao: string
): Promise<ResultadoTentativa> {
  const dinamica = await prisma.dinamica.findUnique({
    where: { id: dinamicaId },
    select: {
      tipo: true,
      valorTesouro: true,
      tesouroVencedorEquipaId: true,
      cartoesTesouro: {
        orderBy: { createdAt: "asc" },
        select: { codigo: true },
      },
    },
  });
  if (!dinamica || dinamica.tipo !== "tesouro") {
    throw new Error("Baú não encontrado");
  }

  const chaveCorreta = dinamica.cartoesTesouro
    .map((c) => normalizarCodigo(c.codigo))
    .join("");
  const tentativa = normalizarCodigo(combinacao);
  const correta = chaveCorreta.length > 0 && tentativa === chaveCorreta;

  // Regista sempre a tentativa (alimenta o feed ao vivo).
  await prisma.tesouroTentativa.create({
    data: { dinamicaId, equipaId, combinacao: tentativa, correta },
  });

  if (!correta) {
    return {
      correta: false,
      venceu: false,
      jaAberto: dinamica.tesouroVencedorEquipaId != null,
      vencedorEquipaId: dinamica.tesouroVencedorEquipaId,
    };
  }

  // Chave certa: tenta reclamar o baú (só a 1ª escrita apanha).
  const claim = await prisma.dinamica.updateMany({
    where: { id: dinamicaId, tesouroVencedorEquipaId: null },
    data: { tesouroVencedorEquipaId: equipaId, tesouroAbertoEm: new Date() },
  });

  if (claim.count === 1) {
    // Vencedor! Atribui os pontos no ranking.
    await prisma.classificacao.upsert({
      where: { dinamicaId_equipaId: { dinamicaId, equipaId } },
      create: { dinamicaId, equipaId, pontos: dinamica.valorTesouro },
      update: { pontos: dinamica.valorTesouro },
    });
    return { correta: true, venceu: true, jaAberto: true, vencedorEquipaId: equipaId };
  }

  // Outra equipa reclamou entretanto (ou já estava aberto).
  const atual = await prisma.dinamica.findUnique({
    where: { id: dinamicaId },
    select: { tesouroVencedorEquipaId: true },
  });
  return {
    correta: true,
    venceu: false,
    jaAberto: true,
    vencedorEquipaId: atual?.tesouroVencedorEquipaId ?? null,
  };
}

/** Repõe o baú: limpa vencedor, tentativas e a pontuação atribuída. */
export async function reporTesouro(dinamicaId: string): Promise<void> {
  await prisma.$transaction([
    prisma.tesouroTentativa.deleteMany({ where: { dinamicaId } }),
    prisma.classificacao.deleteMany({ where: { dinamicaId } }),
    prisma.dinamica.update({
      where: { id: dinamicaId },
      data: { tesouroVencedorEquipaId: null, tesouroAbertoEm: null },
    }),
  ]);
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
