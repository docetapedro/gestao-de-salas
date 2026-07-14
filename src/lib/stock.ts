import { prisma } from "@/lib/prisma";

export type Tipo = "ENTRADA" | "SAIDA";

export function normTipo(v: unknown): Tipo {
  return String(v).toUpperCase() === "ENTRADA" ? "ENTRADA" : "SAIDA";
}

/** Saldo (stock actual) por produto: Σentradas − Σsaídas. */
export async function saldosPorProduto(): Promise<Map<string, number>> {
  const grupos = await prisma.movimentoStock.groupBy({
    by: ["produtoId", "tipo"],
    _sum: { quantidade: true },
  });
  const map = new Map<string, number>();
  for (const g of grupos) {
    const q = g._sum.quantidade ?? 0;
    const atual = map.get(g.produtoId) ?? 0;
    map.set(g.produtoId, atual + (g.tipo === "ENTRADA" ? q : -q));
  }
  return map;
}

/** Saldo (stock actual) de um único produto. */
export async function saldoProduto(produtoId: string): Promise<number> {
  const grupos = await prisma.movimentoStock.groupBy({
    by: ["tipo"],
    where: { produtoId },
    _sum: { quantidade: true },
  });
  let saldo = 0;
  for (const g of grupos) {
    const q = g._sum.quantidade ?? 0;
    saldo += g.tipo === "ENTRADA" ? q : -q;
  }
  return saldo;
}
