"use client";

import {
  Bar,
  BarChart,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList,
} from "recharts";

export type Filho = { nome: string; valor: number };
export type IndicadorRow = {
  id: string;
  titulo: string;
  tipoGrafico: string; // bar | line | pie
  temFilhos: boolean;
  valor: number;
  limite: number;
  detalhes: string | null;
  filhos: Filho[];
};

// Paleta equivalente à da app original (Chart.js).
const CORES = ["#36a2eb", "#ff6384", "#ffce56", "#4bc0c0", "#9966ff", "#ff9f40"];

/** Formata número com 2 casas (pt-PT), como o `formatarNumero` original. */
export function fmt(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "0";
  return new Intl.NumberFormat("pt-PT", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/** Máximo sugerido do eixo Y = limite × 1,15 (ou maior valor × 1,15). */
function calcularMaximo(i: IndicadorRow): number {
  const valores =
    i.temFilhos && i.filhos.length > 0
      ? i.filhos.map((f) => f.valor || 0)
      : [i.valor || 0];
  const maior = Math.max(0, ...valores);
  if (i.limite && i.limite > 0) return i.limite * 1.15;
  return maior * 1.15 || 1;
}

export function IndicadorChart({ i }: { i: IndicadorRow }) {
  const temFilhos = i.temFilhos && i.filhos.length > 0;

  // Pizza: Realizado vs Restante (limite − valor).
  if (i.tipoGrafico === "pie" && !temFilhos) {
    const valor = i.valor || 0;
    const restante = Math.max((i.limite || 0) - valor, 0);
    const total = valor + restante;
    const data = [
      { name: "Realizado", value: valor },
      { name: "Restante", value: restante },
    ];
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            outerRadius="75%"
            label={(p: { name?: string; value?: number }) => {
              if (p.name === "Restante") return "";
              const v = p.value ?? 0;
              const pct = total > 0 ? Math.round((v / total) * 100) : 0;
              return `${fmt(v)} (${pct}%)`;
            }}
            labelLine={false}
          >
            <Cell fill="#36a2eb" />
            <Cell fill="#ff6384" />
          </Pie>
          <Legend
            formatter={(value) => (value === "Restante" ? "" : value)}
            verticalAlign="bottom"
          />
          <Tooltip formatter={(v: number) => fmt(v)} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // Dados de barra/linha.
  const data = temFilhos
    ? i.filhos.map((f) => ({ name: f.nome, value: f.valor || 0 }))
    : [{ name: i.titulo, value: i.valor || 0 }];
  const max = calcularMaximo(i);

  if (i.tipoGrafico === "line") {
    return (
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis domain={[0, max]} tick={{ fontSize: 11 }} width={44} />
          <Tooltip formatter={(v: number) => fmt(v)} />
          <Line type="monotone" dataKey="value" stroke="#36a2eb" strokeWidth={2} dot>
            <LabelList
              dataKey="value"
              position="top"
              formatter={(v: number) => fmt(v)}
              style={{ fontSize: 11, fontWeight: 700 }}
            />
          </Line>
        </LineChart>
      </ResponsiveContainer>
    );
  }

  // Barra (predefinido).
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
        <YAxis domain={[0, max]} tick={{ fontSize: 11 }} width={44} />
        <Tooltip formatter={(v: number) => fmt(v)} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
          {data.map((_, idx) => (
            <Cell key={idx} fill={CORES[idx % CORES.length]} />
          ))}
          <LabelList
            dataKey="value"
            position="top"
            formatter={(v: number) => fmt(v)}
            style={{ fontSize: 11, fontWeight: 700 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
