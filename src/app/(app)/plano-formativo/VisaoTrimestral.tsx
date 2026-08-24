"use client";

import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ESTADOS_TURMA,
  ESTADO_TURMA_BADGE,
  ESTADO_TURMA_LABEL,
  TRIMESTRES,
  MESES_CURTO,
  trimestreDoMes,
  naturezaFormacao,
  type EstadoTurma,
} from "@/lib/plano-formativo";

/* ------------------------------- Tipos ---------------------------------- */
// Subconjunto de campos que a grelha trimestral precisa. As estruturas mais
// ricas (PlanoFormativoClient) são estruturalmente compatíveis com estes tipos.
export type PFTurma = {
  id: string;
  codigo: string | null;
  estado: EstadoTurma;
  entidade: string | null;
  formador: string | null;
  local: string | null;
  duracaoHoras: number | null;
  turno: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  _count: { inscricoes: number };
};
export type PFFormacao = {
  nome: string;
  competencia: string | null;
  turmas: PFTurma[];
};

type TurmaFmt = PFTurma & { formacaoNome: string; competencia: string | null };

const BUCKETS: [string, number, number][] = [
  ["1–7", 1, 7],
  ["8–14", 8, 14],
  ["15–21", 15, 21],
  ["22+", 22, 31],
];
const N_COLS = 12; // 3 meses × 4 semanas

function Kpi({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <Card>
      <CardContent className="py-5">
        <div className="text-3xl font-bold text-navy">{value}</div>
        <div className="text-sm text-slate-500">{label}</div>
        {sub && <div className="text-xs text-slate-400">{sub}</div>}
      </CardContent>
    </Card>
  );
}

/* ------------------------- Visão Trimestral (Gantt) ---------------------- */
export function VisaoTrimestral({
  formacoes,
  ano,
}: {
  formacoes: PFFormacao[];
  ano: number | null;
}) {
  const [tri, setTri] = useState(() => trimestreDoMes(new Date().getMonth()));
  const [detalhe, setDetalhe] = useState<TurmaFmt | null>(null);
  const meses = TRIMESTRES[tri - 1].meses;

  const colDe = (mes: number, dia: number) => {
    const mp = meses.indexOf(mes);
    if (mp < 0) return -1;
    const b = dia <= 7 ? 0 : dia <= 14 ? 1 : dia <= 21 ? 2 : 3;
    return mp * 4 + b;
  };

  // Turmas do ano: entram na grelha as cujo intervalo início→fim atravessa o
  // trimestre (não só as que começam nele); as sem data ficam à parte.
  const { rows, semData, totais } = useMemo(() => {
    const noTri: TurmaFmt[] = [];
    const sem: TurmaFmt[] = [];
    for (const f of formacoes)
      for (const t of f.turmas) {
        const tf: TurmaFmt = { ...t, formacaoNome: f.nome, competencia: f.competencia };
        if (!t.dataInicio) {
          sem.push(tf);
          continue;
        }
        const di = new Date(t.dataInicio);
        const df = t.dataFim ? new Date(t.dataFim) : di;
        // Meses absolutos (ano×12+mês) para funcionar mesmo se atravessar o ano.
        const iniAbs = di.getFullYear() * 12 + di.getMonth();
        const fimAbs = Math.max(iniAbs, df.getFullYear() * 12 + df.getMonth());
        const anoRef = ano ?? di.getFullYear();
        const atravessa = meses.some((m) => {
          const abs = anoRef * 12 + m;
          return abs >= iniAbs && abs <= fimAbs;
        });
        if (atravessa) noTri.push(tf);
      }
    const map = new Map<string, TurmaFmt[]>();
    for (const t of noTri) {
      const a = map.get(t.formacaoNome) ?? [];
      a.push(t);
      map.set(t.formacaoNome, a);
    }
    const tot = {
      Transversal: { turmas: 0, formandos: 0 },
      Tech: { turmas: 0, formandos: 0 },
    };
    for (const t of noTri) {
      const nat = naturezaFormacao(t.competencia);
      tot[nat].turmas += 1;
      tot[nat].formandos += t._count.inscricoes;
    }
    return { rows: [...map.entries()], semData: sem, totais: tot };
  }, [formacoes, meses, ano]);

  // Para uma formação, calcula as células cobertas por cada turma (banda).
  function celulas(turmas: TurmaFmt[]) {
    const cells: ({ t: TurmaFmt; inicio: boolean } | null)[] = Array(N_COLS).fill(null);
    for (const t of turmas) {
      const di = new Date(t.dataInicio!);
      let ini = colDe(di.getMonth(), di.getDate());
      if (ini < 0) ini = 0; // começou antes do trimestre
      let fim = ini;
      if (t.dataFim) {
        const df = new Date(t.dataFim);
        const ec = colDe(df.getMonth(), df.getDate());
        fim = ec < 0 ? N_COLS - 1 : Math.max(ini, ec);
      }
      for (let c = Math.max(0, ini); c <= Math.min(N_COLS - 1, fim); c++)
        if (!cells[c]) cells[c] = { t, inicio: c === ini };
    }
    return cells;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={String(tri)} onValueChange={(v) => setTri(Number(v))}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TRIMESTRES.map((tr) => (
              <SelectItem key={tr.value} value={String(tr.value)}>
                {tr.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-slate-500">{ano}</span>
        {/* Legenda de estados */}
        <div className="ml-auto flex flex-wrap gap-1.5">
          {ESTADOS_TURMA.map((e) => (
            <span key={e.value} className={`rounded px-2 py-0.5 text-[11px] ${e.badge}`}>
              {e.label}
            </span>
          ))}
        </div>
      </div>

      {/* Totais por natureza (Visão Geral do trimestre) */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Turmas no trimestre" value={totais.Transversal.turmas + totais.Tech.turmas} />
        <Kpi
          label="Transversais (turmas · formandos)"
          value={totais.Transversal.turmas}
          sub={`${totais.Transversal.formandos} formandos`}
        />
        <Kpi
          label="Tech (turmas · formandos)"
          value={totais.Tech.turmas}
          sub={`${totais.Tech.formandos} formandos`}
        />
      </div>

      {/* Grelha Gantt */}
      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-slate-400">
            Sem turmas com data marcada neste trimestre.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-10 min-w-[220px] border-b border-r border-slate-200 bg-slate-50 p-2 text-left font-semibold text-slate-600"
                  >
                    Formação
                  </th>
                  {meses.map((m) => (
                    <th
                      key={m}
                      colSpan={4}
                      className="border-b border-l border-slate-200 bg-slate-50 p-1.5 text-center font-semibold text-slate-600"
                    >
                      {MESES_CURTO[m]}
                    </th>
                  ))}
                </tr>
                <tr>
                  {meses.map((m) =>
                    BUCKETS.map(([lbl], bi) => (
                      <th
                        key={`${m}-${bi}`}
                        className={`border-b border-slate-200 p-1 text-center font-normal text-slate-400 ${
                          bi === 0 ? "border-l" : ""
                        }`}
                      >
                        {lbl}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map(([nome, turmas]) => {
                  const cells = celulas(turmas);
                  const formadores = [
                    ...new Set(turmas.map((t) => t.formador?.trim()).filter(Boolean)),
                  ].join(", ");
                  return (
                    <tr key={nome} className="hover:bg-slate-50/50">
                      <td className="sticky left-0 z-10 min-w-[220px] border-b border-r border-slate-200 bg-white p-2 text-slate-800">
                        <div>{nome}</div>
                        {formadores && (
                          <div className="text-[11px] font-normal text-slate-500">{formadores}</div>
                        )}
                      </td>
                      {cells.map((c, i) => (
                        <td
                          key={i}
                          className={`border-b border-slate-100 p-0.5 text-center align-middle ${
                            i % 4 === 0 ? "border-l border-slate-200" : ""
                          }`}
                        >
                          {c && (
                            <button
                              type="button"
                              onClick={() => setDetalhe(c.t)}
                              className={`w-full cursor-pointer truncate rounded px-1 py-1 text-[10px] font-medium ${
                                ESTADO_TURMA_BADGE[c.t.estado]
                              }`}
                              title={`${c.t.codigo ?? "Turma"} — ${ESTADO_TURMA_LABEL[c.t.estado]}${
                                c.t.turno ? " · " + c.t.turno : ""
                              } (clicar para ver datas)`}
                            >
                              {c.inicio ? (c.t.codigo ?? "T") + (c.t.turno ? ` · ${c.t.turno}` : "") : "•"}
                            </button>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* Turmas do ano ainda sem data marcada */}
      {semData.length > 0 && (
        <Card>
          <CardContent className="py-4">
            <h4 className="mb-2 text-sm font-semibold text-slate-700">
              Sem data marcada ({semData.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {semData.map((t) => (
                <span
                  key={t.id}
                  className={`rounded-full px-3 py-1 text-xs ${ESTADO_TURMA_BADGE[t.estado]}`}
                  title={ESTADO_TURMA_LABEL[t.estado]}
                >
                  {t.formacaoNome}
                  {t.codigo ? ` · ${t.codigo}` : ""}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {detalhe && (
        <Dialog open onOpenChange={(o) => !o && setDetalhe(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>
                {detalhe.formacaoNome}
                {detalhe.codigo ? ` · ${detalhe.codigo}` : ""}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Badge className={ESTADO_TURMA_BADGE[detalhe.estado]}>
                {ESTADO_TURMA_LABEL[detalhe.estado]}
              </Badge>
              <dl className="space-y-1 text-sm text-slate-600">
                <div>
                  <span className="text-slate-400">Início: </span>
                  {detalhe.dataInicio
                    ? new Date(detalhe.dataInicio).toLocaleDateString("pt-PT")
                    : "—"}
                </div>
                <div>
                  <span className="text-slate-400">Fim: </span>
                  {detalhe.dataFim
                    ? new Date(detalhe.dataFim).toLocaleDateString("pt-PT")
                    : "—"}
                </div>
                <div>
                  <span className="text-slate-400">Formador: </span>
                  {detalhe.formador || "—"}
                </div>
                <div>
                  <span className="text-slate-400">Fornecedor: </span>
                  {detalhe.entidade || "—"}
                </div>
                <div>
                  <span className="text-slate-400">Local: </span>
                  {detalhe.local || "—"}
                </div>
                <div>
                  <span className="text-slate-400">Carga/Turno: </span>
                  {detalhe.duracaoHoras != null ? `${detalhe.duracaoHoras}h` : "—"}
                  {detalhe.turno ? ` · ${detalhe.turno}` : ""}
                </div>
                <div>
                  <span className="text-slate-400">Formandos: </span>
                  {detalhe._count.inscricoes}
                </div>
              </dl>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDetalhe(null)}>
                Fechar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
