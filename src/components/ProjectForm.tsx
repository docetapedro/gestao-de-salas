"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { MODALIDADES, NIVEIS, formatNum } from "@/lib/projetos";
import DatePicker from "@/components/DatePicker";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, Users, Coins, Award } from "lucide-react";

// Classe partilhada para os <select> nativos (mantidos por causa da opção "—"
// com value="" e da sincronização de estado existente). Visual alinhado ao Input.
const selectClass =
  "flex h-8 w-full items-center rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50";

type Lookup = { id: string; nome: string };
type Rubrica = { id: string; nome: string; tipo: string; ordem: number };
type Formador = { id: string; nome: string; tipo: string };

type Participante = {
  origem: string;
  tipo: string;
  quantidade: number;
  concluidos: number;
};

export type ProjectInitial = {
  id: string;
  codigo?: string | null;
  nome: string;
  descricao: string | null;
  segmentoMercado: string | null;
  codigoTurma: string | null;
  clienteId: string | null;
  pilarId: string | null;
  localId: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  duracaoHoras: number | null;
  modalidade: string | null;
  nivel: string | null;
  formadorInterno: boolean;
  selecaoFormador: string | null;
  nps: number | null;
  taxaConclusao: number | null;
  taxaPresenca: number | null;
  taxaAprovacao: number | null;
  avalFormador: number | null;
  reclamacoes: number | null;
  avConteudo: number | null;
  avClareza: number | null;
  avMateriais: number | null;
  avOrganizacao: number | null;
  avAplicabilidade: number | null;
  comentarios: string | null;
  responsavelPedagogica: string | null;
  formadores: { formadorId: string }[];
  participantes: Participante[];
  financeiro: { rubricaId: string; previsto: number; realizado: number }[];
  // Turmas com os lançamentos (só para mostrar um resumo read-only na edição).
  turmas?: {
    id: string;
    codigo: string | null;
    financeiro: {
      previsto: number;
      realizado: number;
      rubrica: { nome: string; tipo: string };
    }[];
  }[];
};

const n = (v: number | null | undefined) => (v === null || v === undefined ? "" : String(v));
const s = (v: string | null | undefined) => v ?? "";
const dateInput = (v: string | null | undefined) => (v ? v.slice(0, 10) : "");

export default function ProjectForm({ initial }: { initial?: ProjectInitial }) {
  const router = useRouter();
  const [pilares, setPilares] = useState<Lookup[]>([]);
  const [locais, setLocais] = useState<Lookup[]>([]);
  const [clientes, setClientes] = useState<Lookup[]>([]);
  const [formadores, setFormadores] = useState<Formador[]>([]);
  const [rubricas, setRubricas] = useState<Rubrica[]>([]);

  const [form, setForm] = useState({
    nome: s(initial?.nome),
    descricao: s(initial?.descricao),
    segmentoMercado: s(initial?.segmentoMercado),
    codigoTurma: s(initial?.codigoTurma),
    clienteId: s(initial?.clienteId),
    pilarId: s(initial?.pilarId),
    localId: s(initial?.localId),
    dataInicio: dateInput(initial?.dataInicio),
    dataFim: dateInput(initial?.dataFim),
    duracaoHoras: n(initial?.duracaoHoras),
    modalidade: s(initial?.modalidade),
    nivel: s(initial?.nivel),
    formadorInterno: initial?.formadorInterno ?? true,
    selecaoFormador: s(initial?.selecaoFormador),
    nps: n(initial?.nps),
    taxaConclusao: n(initial?.taxaConclusao),
    taxaPresenca: n(initial?.taxaPresenca),
    taxaAprovacao: n(initial?.taxaAprovacao),
    avalFormador: n(initial?.avalFormador),
    reclamacoes: n(initial?.reclamacoes ?? 0),
    avConteudo: n(initial?.avConteudo),
    avClareza: n(initial?.avClareza),
    avMateriais: n(initial?.avMateriais),
    avOrganizacao: n(initial?.avOrganizacao),
    avAplicabilidade: n(initial?.avAplicabilidade),
    comentarios: s(initial?.comentarios),
    responsavelPedagogica: s(initial?.responsavelPedagogica),
  });

  const [formadorIds, setFormadorIds] = useState<string[]>(
    initial?.formadores.map((f) => f.formadorId) ?? []
  );
  const [participantes, setParticipantes] = useState<Participante[]>(
    initial?.participantes.map((p) => ({
      origem: s(p.origem),
      tipo: p.tipo,
      quantidade: p.quantidade ?? 1,
      concluidos: p.concluidos ?? 0,
    })) ?? []
  );
  const [fin, setFin] = useState<Record<string, { previsto: string; realizado: string }>>(
    () => {
      const map: Record<string, { previsto: string; realizado: string }> = {};
      initial?.financeiro.forEach((f) => {
        map[f.rubricaId] = { previsto: n(f.previsto), realizado: n(f.realizado) };
      });
      return map;
    }
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<{ pilares: Lookup[] }>("/api/pilares"),
      api<{ rooms: { id: string; name: string }[] }>("/api/rooms"),
      api<{ formadores: Formador[] }>("/api/formadores"),
      api<{ rubricas: Rubrica[] }>("/api/rubricas"),
      api<{ clientes: Lookup[] }>("/api/clientes"),
    ])
      .then(([a, b, c, d, e]) => {
        setPilares(a.pilares);
        // "Local / Sala" reutiliza a tabela de Salas.
        setLocais(b.rooms.map((r) => ({ id: r.id, nome: r.name })));
        setFormadores(c.formadores);
        setRubricas(d.rubricas);
        setClientes(e.clientes);
      })
      .catch((e) => setError((e as Error).message));
  }, []);

  const receitas = useMemo(() => rubricas.filter((r) => r.tipo === "RECEITA"), [rubricas]);
  const custos = useMemo(() => rubricas.filter((r) => r.tipo === "CUSTO"), [rubricas]);

  // Totais dos participantes (grupos) e taxa de conclusão derivada.
  const inscritosTotal = useMemo(
    () => participantes.reduce((sum, p) => sum + (p.quantidade || 0), 0),
    [participantes]
  );
  const concluidosTotal = useMemo(
    () => participantes.reduce((sum, p) => sum + (p.concluidos || 0), 0),
    [participantes]
  );
  const taxaConclusaoCalc =
    inscritosTotal > 0 ? (concluidosTotal / inscritosTotal) * 100 : null;

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function setFinValue(id: string, campo: "previsto" | "realizado", value: string) {
    setFin((m) => {
      const cur = m[id] ?? { previsto: "", realizado: "" };
      return { ...m, [id]: { ...cur, [campo]: value } };
    });
  }

  function addParticipante() {
    setParticipantes((p) => [
      ...p,
      { origem: "", tipo: "B2C", quantidade: 1, concluidos: 0 },
    ]);
  }
  function updParticipante(i: number, patch: Partial<Participante>) {
    setParticipantes((list) => list.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function rmParticipante(i: number) {
    setParticipantes((list) => list.filter((_, idx) => idx !== i));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const financeiro = Object.entries(fin)
        .map(([rubricaId, v]) => ({
          rubricaId,
          previsto: v.previsto === "" ? 0 : Number(v.previsto),
          realizado: v.realizado === "" ? 0 : Number(v.realizado),
        }))
        .filter((f) => f.previsto !== 0 || f.realizado !== 0);

      const payload = {
        ...form,
        duracaoHoras: form.duracaoHoras === "" ? null : Number(form.duracaoHoras),
        nps: form.nps === "" ? null : Number(form.nps),
        taxaConclusao: taxaConclusaoCalc,
        taxaPresenca: form.taxaPresenca === "" ? null : Number(form.taxaPresenca),
        taxaAprovacao: form.taxaAprovacao === "" ? null : Number(form.taxaAprovacao),
        avalFormador: form.avalFormador === "" ? null : Number(form.avalFormador),
        reclamacoes: form.reclamacoes === "" ? 0 : Number(form.reclamacoes),
        avConteudo: form.avConteudo === "" ? null : Number(form.avConteudo),
        avClareza: form.avClareza === "" ? null : Number(form.avClareza),
        avMateriais: form.avMateriais === "" ? null : Number(form.avMateriais),
        avOrganizacao: form.avOrganizacao === "" ? null : Number(form.avOrganizacao),
        avAplicabilidade:
          form.avAplicabilidade === "" ? null : Number(form.avAplicabilidade),
        formadorIds,
        participantes: participantes.filter((p) => p.origem.trim() && p.quantidade > 0),
        financeiro,
      };

      if (initial) {
        await api(`/api/projetos/${initial.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        router.push(`/projetos/${initial.id}`);
      } else {
        const { projeto } = await api<{ projeto: { id: string } }>("/api/projetos", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        router.push(`/projetos/${projeto.id}`);
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-6 max-w-5xl [&_input]:h-8 [&_select]:h-8"
    >
      {error && (
        <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-200">
          {error}
        </div>
      )}

      {/* Botões no topo — sempre visíveis, em qualquer separador */}
      <div className="flex items-center justify-end gap-2 border-b border-slate-200 pb-3">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button type="submit" variant="navy" disabled={saving}>
          {saving ? "Salvando…" : initial ? "Guardar alterações" : "Criar projecto"}
        </Button>
      </div>

      <Tabs defaultValue="ident" className="w-full">
        <TabsList className="mb-4 flex h-auto flex-wrap justify-start gap-1 bg-slate-100">
          <TabsTrigger value="ident">
            <ClipboardList /> Identificação &amp; Público
          </TabsTrigger>
          <TabsTrigger value="participantes">
            <Users /> Participantes
          </TabsTrigger>
          <TabsTrigger value="financeiro">
            <Coins /> Financeiro &amp; ROI
          </TabsTrigger>
          <TabsTrigger value="qualidade">
            <Award /> Qualidade
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ident">
      {/* Identificação */}
      <Section title="Identificação & Público">
        <Grid>
          {initial?.codigo && (
            <Field label="Código do Projecto" full>
              <Input
                readOnly
                value={initial.codigo}
                className="bg-slate-50 font-mono text-slate-600"
              />
            </Field>
          )}
          <Field label="Nome do Projecto *" full>
            <Input
              required
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
            />
          </Field>
          <Field label="Descrição" full>
            <Textarea
              rows={2}
              value={form.descricao}
              onChange={(e) => set("descricao", e.target.value)}
            />
          </Field>
          <Field label="Segmento de Mercado">
            <select
              className={selectClass}
              value={form.segmentoMercado}
              onChange={(e) => set("segmentoMercado", e.target.value)}
            >
              <option value="">—</option>
              <option value="B2C">B2C</option>
              <option value="B2B">B2B</option>
              <option value="B2G">B2G</option>
            </select>
          </Field>
          <Field label="Pilar">
            <select
              className={selectClass}
              value={form.pilarId}
              onChange={(e) => set("pilarId", e.target.value)}
            >
              <option value="">—</option>
              {pilares.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cliente">
            <select
              className={selectClass}
              value={form.clienteId}
              onChange={(e) => set("clienteId", e.target.value)}
            >
              <option value="">—</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            {clientes.length === 0 && (
              <p className="text-xs text-slate-400 mt-1">
                Nenhum cliente cadastrado (adicione em Cadastros).
              </p>
            )}
          </Field>
          <Field label="Local / Sala">
            <select
              className={selectClass}
              value={form.localId}
              onChange={(e) => set("localId", e.target.value)}
            >
              <option value="">—</option>
              {locais.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nome}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Data de Início">
            <DatePicker
              value={form.dataInicio}
              onChange={(v) => set("dataInicio", v)}
            />
          </Field>
          <Field label="Data de Fim">
            <DatePicker value={form.dataFim} onChange={(v) => set("dataFim", v)} />
          </Field>
          <Field label="Duração (horas)">
            <Input
              type="number"
              step="0.5"
              min="0"
              value={form.duracaoHoras}
              onChange={(e) => set("duracaoHoras", e.target.value)}
            />
          </Field>
          <Field label="Modalidade">
            <select
              className={selectClass}
              value={form.modalidade}
              onChange={(e) => set("modalidade", e.target.value)}
            >
              <option value="">—</option>
              {MODALIDADES.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nível">
            <select
              className={selectClass}
              value={form.nivel}
              onChange={(e) => set("nivel", e.target.value)}
            >
              <option value="">—</option>
              {NIVEIS.map((nv) => (
                <option key={nv.value} value={nv.value}>
                  {nv.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Seleção do Formador">
            <Input
              placeholder="Ex.: Múltipla escolha"
              value={form.selecaoFormador}
              onChange={(e) => set("selecaoFormador", e.target.value)}
            />
          </Field>
          <Field label="Formador interno?" full>
            <label className="flex items-center gap-2 text-sm text-slate-700 mt-1">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300 text-navy focus:ring-2 focus:ring-ring"
                checked={form.formadorInterno}
                onChange={(e) => set("formadorInterno", e.target.checked)}
              />
              O corpo técnico é interno
            </label>
          </Field>
          <Field label="Formadores / Corpo Técnico" full>
            <div className="flex flex-wrap gap-2 mt-1">
              {formadores.length === 0 && (
                <span className="text-sm text-slate-400">
                  Nenhum formador cadastrado ainda (adicione em Cadastros).
                </span>
              )}
              {formadores.map((f) => {
                const on = formadorIds.includes(f.id);
                return (
                  <button
                    type="button"
                    key={f.id}
                    onClick={() =>
                      setFormadorIds((ids) =>
                        on ? ids.filter((x) => x !== f.id) : [...ids, f.id]
                      )
                    }
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm border transition-colors",
                      on
                        ? "bg-navy text-white border-navy"
                        : "bg-white text-slate-600 border-slate-300 hover:border-navy"
                    )}
                  >
                    {f.nome}
                    <span className="opacity-60 ml-1 text-xs">
                      {f.tipo === "EXTERNO" ? "ext" : "int"}
                    </span>
                  </button>
                );
              })}
            </div>
          </Field>
        </Grid>
      </Section>
        </TabsContent>

        <TabsContent value="participantes">
      {/* Participantes */}
      <Section title="Participantes / Inscritos">
        <div className="space-y-2">
          {participantes.length > 0 && (
            <div className="hidden md:grid grid-cols-12 gap-2 px-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
              <span className="col-span-5">Empresa / Origem</span>
              <span className="col-span-2">Tipo</span>
              <span className="col-span-2">Qtd</span>
              <span className="col-span-2">Concluídos</span>
              <span className="col-span-1" />
            </div>
          )}
          {participantes.map((p, i) => (
            <div
              key={i}
              className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center rounded-lg border border-slate-200 p-2"
            >
              <Input
                className="md:col-span-5"
                placeholder="Empresa / Origem"
                value={p.origem}
                onChange={(e) => updParticipante(i, { origem: e.target.value })}
              />
              <select
                className={cn(selectClass, "md:col-span-2")}
                value={p.tipo}
                onChange={(e) => updParticipante(i, { tipo: e.target.value })}
              >
                <option value="B2C">B2C</option>
                <option value="B2B">B2B</option>
              </select>
              <Input
                type="number"
                min={1}
                className="md:col-span-2"
                placeholder="Qtd"
                title="Nº de formandos"
                value={p.quantidade}
                onChange={(e) => {
                  const quantidade = Math.max(1, Number(e.target.value) || 1);
                  updParticipante(i, {
                    quantidade,
                    concluidos: Math.min(p.concluidos, quantidade),
                  });
                }}
              />
              <Input
                type="number"
                min={0}
                max={p.quantidade}
                className="md:col-span-2"
                placeholder="Concluídos"
                title="Nº de formandos que concluíram"
                value={p.concluidos}
                onChange={(e) =>
                  updParticipante(i, {
                    concluidos: Math.min(p.quantidade, Math.max(0, Number(e.target.value) || 0)),
                  })
                }
              />
              <Button
                type="button"
                variant="link"
                onClick={() => rmParticipante(i)}
                className="text-red-600 md:col-span-1 h-auto p-0 justify-start"
              >
                Remover
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="secondary"
            onClick={addParticipante}
            className="bg-brand-50 text-brand-700 hover:bg-brand-100"
          >
            + Adicionar participante
          </Button>
        </div>
      </Section>
        </TabsContent>

        <TabsContent value="financeiro">
      {/* Financeiro — lançado por turma no detalhe. Aqui mostra-se só leitura. */}
      <Section title="Financeiro & ROI">
        {initial?.turmas && initial.turmas.length > 0 ? (
          <div className="space-y-4">
            {initial.turmas.map((t) => (
              <div key={t.id}>
                <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Turma {t.codigo || "—"}
                </div>
                {t.financeiro.length === 0 ? (
                  <p className="text-sm text-slate-400">Sem lançamentos.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                          <th className="pb-1 font-medium">Rubrica</th>
                          <th className="pb-1 text-right font-medium">Previsto (AOA)</th>
                          <th className="pb-1 text-right font-medium">Realizado (AOA)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {t.financeiro.map((f, i) => (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="py-1.5 text-slate-700">
                              {f.rubrica.nome}
                              <span className="ml-2 text-xs text-slate-400">
                                {f.rubrica.tipo === "RECEITA" ? "Receita" : "Custo"}
                              </span>
                            </td>
                            <td className="py-1.5 text-right text-slate-500">
                              {formatNum(f.previsto)}
                            </td>
                            <td className="py-1.5 text-right font-medium text-slate-700">
                              {formatNum(f.realizado)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
            <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-xs text-slate-500">
              Só leitura. Para lançar ou editar rubricas, volta ao relatório do
              projecto e usa <b>Lançar rubricas</b> na turma pretendida.
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">
            Os lançamentos financeiros são feitos <b>por turma</b>, na página do
            projecto. Depois de guardar, abre o projecto e lança as rubricas
            (previsto/realizado) na turma pretendida.
          </div>
        )}
      </Section>
        </TabsContent>

        <TabsContent value="qualidade">
      {/* Qualidade */}
      <Section title="Qualidade & Avaliação">
        <Grid>
          <Field label="NPS da Formação (meta ≥ 70)">
            <Input type="number" step="0.1" value={form.nps}
              onChange={(e) => set("nps", e.target.value)} />
          </Field>
          <Field label="Taxa de Conclusão % (calculada dos participantes)">
            <Input
              className="bg-slate-50 text-slate-500"
              readOnly
              title={`${concluidosTotal} concluídos de ${inscritosTotal} inscritos`}
              value={taxaConclusaoCalc === null ? "—" : taxaConclusaoCalc.toFixed(1)}
            />
          </Field>
          <Field label="Taxa de Presença % (≥ 85)">
            <Input type="number" step="0.1" value={form.taxaPresenca}
              onChange={(e) => set("taxaPresenca", e.target.value)} />
          </Field>
          <Field label="Taxa de Aprovação % (≥ 80)">
            <Input type="number" step="0.1" value={form.taxaAprovacao}
              onChange={(e) => set("taxaAprovacao", e.target.value)} />
          </Field>
          <Field label="Aval. do Formador (≥ 4,3)">
            <Input type="number" step="0.1" value={form.avalFormador}
              onChange={(e) => set("avalFormador", e.target.value)} />
          </Field>
          <Field label="Reclamações / Incidentes (meta 0)">
            <Input type="number" step="1" value={form.reclamacoes}
              onChange={(e) => set("reclamacoes", e.target.value)} />
          </Field>
        </Grid>
        <p className="text-xs font-semibold text-slate-500 uppercase mt-4 mb-2">
          Avaliação por critério (NPS detalhado)
        </p>
        <Grid>
          <Field label="Conteúdo / Relevância">
            <Input type="number" step="0.1" value={form.avConteudo}
              onChange={(e) => set("avConteudo", e.target.value)} />
          </Field>
          <Field label="Clareza do Formador">
            <Input type="number" step="0.1" value={form.avClareza}
              onChange={(e) => set("avClareza", e.target.value)} />
          </Field>
          <Field label="Materiais de Apoio">
            <Input type="number" step="0.1" value={form.avMateriais}
              onChange={(e) => set("avMateriais", e.target.value)} />
          </Field>
          <Field label="Organização / Logística">
            <Input type="number" step="0.1" value={form.avOrganizacao}
              onChange={(e) => set("avOrganizacao", e.target.value)} />
          </Field>
          <Field label="Aplicabilidade Prática">
            <Input type="number" step="0.1" value={form.avAplicabilidade}
              onChange={(e) => set("avAplicabilidade", e.target.value)} />
          </Field>
        </Grid>
        <Grid>
          <Field label="Comentários / Observações" full>
            <Textarea rows={3} value={form.comentarios}
              onChange={(e) => set("comentarios", e.target.value)} />
          </Field>
          <Field label="Responsável Pedagógica" full>
            <Input value={form.responsavelPedagogica}
              onChange={(e) => set("responsavelPedagogica", e.target.value)} />
          </Field>
        </Grid>
      </Section>
        </TabsContent>
      </Tabs>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #cbd5e1;
          padding: 0.5rem 0.75rem;
          outline: none;
          background: #fff;
        }
        .input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px #bfdbfe;
        }
      `}</style>
    </form>
  );
}

function FinRow({
  r,
  fin,
  onChange,
}: {
  r: Rubrica;
  fin: Record<string, { previsto: string; realizado: string }>;
  onChange: (id: string, campo: "previsto" | "realizado", value: string) => void;
}) {
  const v = fin[r.id] || { previsto: "", realizado: "" };
  return (
    <tr className="border-t border-slate-100">
      <td className="py-1.5 pr-2 text-slate-700">{r.nome}</td>
      <td className="py-1.5 pr-2">
        <MoneyInput
          value={v.previsto}
          onChange={(raw) => onChange(r.id, "previsto", raw)}
        />
      </td>
      <td className="py-1.5">
        <MoneyInput
          value={v.realizado}
          onChange={(raw) => onChange(r.id, "realizado", raw)}
        />
      </td>
    </tr>
  );
}

/**
 * Campo monetário (AOA): mostra separador de milhares "." e decimal ",",
 * guardando o valor canónico (número com "." decimal) via onChange.
 */
function moneyToDisplay(canonical: string): string {
  if (canonical === "" || canonical == null) return "";
  const [int, dec] = String(canonical).split(".");
  const grouped = (int || "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return dec != null ? `${grouped},${dec}` : grouped;
}

function MoneyInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (raw: string) => void;
}) {
  const [text, setText] = useState(() => moneyToDisplay(value));

  // Mantém o display em sincronia se o valor externo mudar (ex.: reset/editar).
  useEffect(() => {
    const parsed = text.replace(/\./g, "").replace(",", ".");
    const current = parsed === "" || parsed === "." ? "" : parsed;
    if (current !== value) setText(moneyToDisplay(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    let t = e.target.value.replace(/[^\d.,]/g, "");
    // "." é separador de milhares → ignora; "," é o decimal.
    const parts = t.replace(/\./g, "").split(",");
    const intPart = parts[0] || "";
    const decPart = parts.length > 1 ? parts.slice(1).join("").slice(0, 2) : null;
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    setText(decPart === null ? grouped : `${grouped},${decPart}`);
    const canonical =
      intPart === "" && decPart === null
        ? ""
        : `${intPart || "0"}${decPart !== null ? "." + decPart : ""}`;
    onChange(canonical);
  }

  return (
    <div className="relative">
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none z-10">
        AOA
      </span>
      <Input
        className="text-right"
        inputMode="decimal"
        placeholder="0,00"
        value={text}
        onChange={handle}
        style={{ paddingLeft: "2.5rem" }}
      />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="overflow-hidden rounded-2xl">
      <CardHeader className="bg-navy px-5 py-3">
        <CardTitle className="text-white font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-5 pt-5">{children}</CardContent>
    </Card>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>;
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <Label className="mb-1 block">{label}</Label>
      {children}
    </div>
  );
}
