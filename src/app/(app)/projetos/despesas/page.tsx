"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Coins, Pencil, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import {
  desvioPct,
  formatNum,
  formatPct,
  type Financeiro,
} from "@/lib/projetos";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/Modal";
import { MoneyInput } from "@/components/MoneyInput";

type ProjetoLista = {
  id: string;
  codigo: string | null;
  nome: string;
};

type FinItem = {
  id: string;
  rubricaId: string;
  previsto: number;
  realizado: number;
  rubrica: { nome: string; tipo: string };
};
type Turma = {
  id: string;
  codigo: string | null;
  nome: string | null;
  financeiro: FinItem[];
};
type ProjetoDetalhe = {
  id: string;
  nome: string;
  codigo: string | null;
  turmas: Turma[];
};
type Rubrica = { id: string; nome: string; tipo: string };

const msg = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado");
const NENHUM = "";

export default function DespesasCustosPage() {
  const [projetos, setProjetos] = useState<ProjetoLista[]>([]);
  const [rubricas, setRubricas] = useState<Rubrica[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [projetoId, setProjetoId] = useState(NENHUM);
  const [turmaId, setTurmaId] = useState(NENHUM);
  const [detalhe, setDetalhe] = useState<ProjetoDetalhe | null>(null);
  const [loadingDet, setLoadingDet] = useState(false);

  // Formulário de lançamento
  const [rubricaId, setRubricaId] = useState(NENHUM);
  const [previsto, setPrevisto] = useState("");
  const [realizado, setRealizado] = useState("");
  const [saving, setSaving] = useState(false);
  const [delItem, setDelItem] = useState<FinItem | null>(null);

  useEffect(() => {
    api<{ projetos: ProjetoLista[] }>("/api/projetos")
      .then((d) => setProjetos(d.projetos))
      .catch((e) => setError(msg(e)));
    api<{ rubricas: Rubrica[] }>("/api/rubricas")
      .then((d) => setRubricas(d.rubricas))
      .catch(() => {});
  }, []);

  const carregarDetalhe = useCallback(async (id: string) => {
    setLoadingDet(true);
    try {
      const d = await api<{ projeto: ProjetoDetalhe }>(`/api/projetos/${id}`);
      setDetalhe(d.projeto);
    } catch (e) {
      setError(msg(e));
    } finally {
      setLoadingDet(false);
    }
  }, []);

  function escolherProjeto(id: string) {
    setProjetoId(id);
    setTurmaId(NENHUM);
    setDetalhe(null);
    limparForm();
    if (id) carregarDetalhe(id);
  }

  function limparForm() {
    setRubricaId(NENHUM);
    setPrevisto("");
    setRealizado("");
  }

  const turma = useMemo(
    () => detalhe?.turmas.find((t) => t.id === turmaId) ?? null,
    [detalhe, turmaId]
  );

  // Ao escolher uma rubrica já lançada, pré-preenche os valores para edição.
  function escolherRubrica(id: string) {
    setRubricaId(id);
    const existente = turma?.financeiro.find((f) => f.rubricaId === id);
    setPrevisto(existente ? String(existente.previsto) : "");
    setRealizado(existente ? String(existente.realizado) : "");
  }

  async function lancar(e: React.FormEvent) {
    e.preventDefault();
    if (!turma) return toast.error("Escolhe uma turma");
    if (!rubricaId) return toast.error("Escolhe uma rubrica");
    setSaving(true);
    try {
      await api(`/api/turmas/${turma.id}/financeiro`, {
        method: "POST",
        body: JSON.stringify({
          rubricaId,
          previsto: Number(previsto) || 0,
          realizado: Number(realizado) || 0,
        }),
      });
      toast.success("Lançamento guardado");
      limparForm();
      await carregarDetalhe(projetoId);
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setSaving(false);
    }
  }

  async function removerItem() {
    if (!delItem) return;
    try {
      await api(`/api/financeiro/${delItem.id}`, { method: "DELETE" });
      toast.success("Lançamento removido");
      setDelItem(null);
      await carregarDetalhe(projetoId);
    } catch (e) {
      toast.error(msg(e));
    }
  }

  const rubricasOrdenadas = useMemo(
    () =>
      [...rubricas].sort((a, b) =>
        a.tipo === b.tipo
          ? a.nome.localeCompare(b.nome)
          : a.tipo === "RECEITA"
            ? -1
            : 1
      ),
    [rubricas]
  );

  const receitas = turma?.financeiro.filter((f) => f.rubrica.tipo === "RECEITA") ?? [];
  const custos = turma?.financeiro.filter((f) => f.rubrica.tipo === "CUSTO") ?? [];

  // Totais (mesmos cálculos do relatório).
  const fin: Pick<Financeiro, "receita" | "custo" | "margem"> = useMemo(() => {
    const soma = (itens: FinItem[]) =>
      itens.reduce(
        (acc, it) => ({
          previsto: acc.previsto + (it.previsto || 0),
          realizado: acc.realizado + (it.realizado || 0),
        }),
        { previsto: 0, realizado: 0 }
      );
    const receita = soma(receitas);
    const custo = soma(custos);
    return {
      receita,
      custo,
      margem: {
        previsto: receita.previsto - custo.previsto,
        realizado: receita.realizado - custo.realizado,
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turma]);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Despesas e Custos</h1>
          <p className="text-sm text-muted-foreground">
            Escolhe o projecto e a turma para lançar as rubricas (previsto /
            realizado), tal como no relatório.
          </p>
        </div>
        <Link href="/projetos" className="text-sm text-brand-600 hover:underline">
          ← Projectos
        </Link>
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Selecção de projecto e turma */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[16rem] flex-1">
            <Label className="mb-1 block">Projecto</Label>
            <Select value={projetoId} onValueChange={escolherProjeto}>
              <SelectTrigger>
                <SelectValue placeholder="Escolher projecto" />
              </SelectTrigger>
              <SelectContent>
                {projetos.length === 0 && (
                  <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                    Sem projectos.
                  </div>
                )}
                {projetos.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.codigo ? `${p.codigo} · ` : ""}
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[14rem] flex-1">
            <Label className="mb-1 block">Turma</Label>
            <Select
              value={turmaId}
              onValueChange={(v) => {
                setTurmaId(v);
                limparForm();
              }}
              disabled={!detalhe || loadingDet}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    !projetoId
                      ? "Escolhe primeiro o projecto"
                      : loadingDet
                        ? "A carregar…"
                        : "Escolher turma"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {detalhe?.turmas.length === 0 && (
                  <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                    Este projecto ainda não tem turmas. Cria no relatório.
                  </div>
                )}
                {detalhe?.turmas.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.codigo || t.nome || "Turma sem código"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {!turma ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Selecciona um projecto e uma turma para lançar as despesas e custos.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Formulário de lançamento */}
          <Card>
            <CardContent className="p-4">
              <form
                onSubmit={lancar}
                className="flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-3"
              >
                <div className="min-w-[12rem] flex-1">
                  <Label className="mb-1 block text-xs">Rubrica</Label>
                  <Select value={rubricaId} onValueChange={escolherRubrica}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Escolher rubrica" />
                    </SelectTrigger>
                    <SelectContent>
                      {rubricasOrdenadas.length === 0 && (
                        <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                          Cria rubricas em Cadastros.
                        </div>
                      )}
                      {rubricasOrdenadas.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.nome} · {r.tipo === "RECEITA" ? "Receita" : "Custo"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-36">
                  <Label className="mb-1 block text-xs">Previsto (AOA)</Label>
                  <MoneyInput
                    value={previsto}
                    onChange={setPrevisto}
                    prefix={null}
                    className="bg-white"
                  />
                </div>
                <div className="w-36">
                  <Label className="mb-1 block text-xs">Realizado (AOA)</Label>
                  <MoneyInput
                    value={realizado}
                    onChange={setRealizado}
                    prefix={null}
                    className="bg-white"
                  />
                </div>
                <Button type="submit" variant="navy" disabled={saving}>
                  {saving ? "A guardar…" : "Lançar"}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Tabela financeira — igual ao relatório */}
          <Card>
            <CardContent className="p-4">
              <div className="mb-3 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-brand-50 text-brand-600">
                  <Coins className="h-4 w-4" />
                </span>
                <h2 className="text-sm font-semibold text-navy">
                  Financeiro — Turma {turma.codigo || turma.nome || ""}
                </h2>
              </div>

              {turma.financeiro.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Ainda sem lançamentos nesta turma.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400">
                      <th className="pb-1 font-medium">Rubrica</th>
                      <th className="pb-1 text-right font-medium">Previsto (AOA)</th>
                      <th className="pb-1 text-right font-medium">Realizado (AOA)</th>
                      <th className="pb-1 text-right font-medium">Desvio (%)</th>
                      <th className="w-16" />
                    </tr>
                  </thead>
                  <tbody>
                    {receitas.map((f) => (
                      <FinLinha
                        key={f.id}
                        f={f}
                        onEdit={() => escolherRubrica(f.rubricaId)}
                        onDelete={() => setDelItem(f)}
                      />
                    ))}
                    {custos.map((f) => (
                      <FinLinha
                        key={f.id}
                        f={f}
                        custo
                        onEdit={() => escolherRubrica(f.rubricaId)}
                        onDelete={() => setDelItem(f)}
                      />
                    ))}
                    <tr className="border-t border-slate-200 font-semibold text-slate-800">
                      <td className="py-1">Custo Total</td>
                      <td className="py-1 text-right">{formatNum(fin.custo.previsto)}</td>
                      <td className="py-1 text-right">{formatNum(fin.custo.realizado)}</td>
                      <td />
                      <td />
                    </tr>
                    <tr className="font-semibold text-slate-800">
                      <td className="py-1">Margem Bruta</td>
                      <td className="py-1 text-right">{formatNum(fin.margem.previsto)}</td>
                      <td className="py-1 text-right">{formatNum(fin.margem.realizado)}</td>
                      <td />
                      <td />
                    </tr>
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {delItem && (
        <ConfirmDialog
          title="Remover lançamento"
          danger
          confirmLabel="Remover"
          message={
            <>
              Remover o lançamento de <b>{delItem.rubrica.nome}</b> desta turma?
            </>
          }
          onConfirm={removerItem}
          onCancel={() => setDelItem(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------- Linha fin ------------------------------- */

function desvioBom(v: number | null, custo = false): boolean | null {
  if (v === null || v === 0) return null;
  return custo ? v < 0 : v > 0;
}
function desvioClass(v: number | null, custo = false): string {
  const bom = desvioBom(v, custo);
  if (bom === null) return "text-slate-600";
  return bom ? "text-emerald-600" : "text-red-600";
}

function FinLinha({
  f,
  custo,
  onEdit,
  onDelete,
}: {
  f: FinItem;
  custo?: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const desvio = desvioPct(f.previsto, f.realizado);
  const bom = desvioBom(desvio, custo);
  const desvioMostrado = bom === true && desvio !== null ? Math.abs(desvio) : desvio;
  return (
    <tr className="border-t border-slate-100">
      <td className="py-1.5 text-slate-600">
        {f.rubrica.nome}
        <Badge
          variant={custo ? "secondary" : "success"}
          className="ml-2 rounded px-1.5 py-0 text-[10px]"
        >
          {custo ? "Custo" : "Receita"}
        </Badge>
      </td>
      <td className="py-1.5 text-right text-slate-600">{formatNum(f.previsto)}</td>
      <td className="py-1.5 text-right font-medium text-slate-700">
        {formatNum(f.realizado)}
      </td>
      <td className={`py-1.5 text-right ${desvioClass(desvio, custo)}`}>
        {formatPct(desvioMostrado, 1)}
      </td>
      <td className="py-1.5">
        <div className="flex items-center justify-end gap-3">
          <button
            onClick={onEdit}
            className="text-slate-400 hover:text-brand-600"
            title="Editar valores"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="text-slate-400 hover:text-destructive"
            title="Remover"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
}
