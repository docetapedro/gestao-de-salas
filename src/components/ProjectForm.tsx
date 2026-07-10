"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { MODALIDADES, NIVEIS } from "@/lib/projetos";

type Lookup = { id: string; nome: string };
type Rubrica = { id: string; nome: string; tipo: string; ordem: number };
type Formador = { id: string; nome: string; tipo: string };

type Participante = {
  nome: string;
  tipo: string;
  origem: string;
  telefone: string;
  email: string;
  concluido: boolean;
};

export type ProjectInitial = {
  id: string;
  nome: string;
  descricao: string | null;
  areaTematica: string | null;
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
    areaTematica: s(initial?.areaTematica),
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
      nome: p.nome,
      tipo: p.tipo,
      origem: s(p.origem),
      telefone: s(p.telefone),
      email: s(p.email),
      concluido: p.concluido,
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
      { nome: "", tipo: "B2C", origem: "", telefone: "", email: "", concluido: false },
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
        taxaConclusao: form.taxaConclusao === "" ? null : Number(form.taxaConclusao),
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
        participantes: participantes.filter((p) => p.nome.trim()),
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
    <form onSubmit={submit} className="space-y-6 max-w-5xl">
      {error && (
        <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-200">
          {error}
        </div>
      )}

      {/* Identificação */}
      <Section title="Identificação & Público">
        <Grid>
          <Field label="Nome da Formação *" full>
            <input
              required
              className="input"
              value={form.nome}
              onChange={(e) => set("nome", e.target.value)}
            />
          </Field>
          <Field label="Descrição" full>
            <textarea
              className="input"
              rows={2}
              value={form.descricao}
              onChange={(e) => set("descricao", e.target.value)}
            />
          </Field>
          <Field label="Área Temática">
            <input
              className="input"
              value={form.areaTematica}
              onChange={(e) => set("areaTematica", e.target.value)}
            />
          </Field>
          <Field label="Pilar">
            <select
              className="input"
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
              className="input"
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
              className="input"
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
            <input
              type="date"
              className="input"
              value={form.dataInicio}
              onChange={(e) => set("dataInicio", e.target.value)}
            />
          </Field>
          <Field label="Data de Fim">
            <input
              type="date"
              className="input"
              value={form.dataFim}
              onChange={(e) => set("dataFim", e.target.value)}
            />
          </Field>
          <Field label="Duração (horas)">
            <input
              type="number"
              step="0.5"
              min="0"
              className="input"
              value={form.duracaoHoras}
              onChange={(e) => set("duracaoHoras", e.target.value)}
            />
          </Field>
          <Field label="Modalidade">
            <select
              className="input"
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
              className="input"
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
            <input
              className="input"
              placeholder="Ex.: Múltipla escolha"
              value={form.selecaoFormador}
              onChange={(e) => set("selecaoFormador", e.target.value)}
            />
          </Field>
          <Field label="Formador interno?" full>
            <label className="flex items-center gap-2 text-sm text-slate-700 mt-1">
              <input
                type="checkbox"
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
                    className={`px-3 py-1.5 rounded-full text-sm border ${
                      on
                        ? "bg-navy text-white border-navy"
                        : "bg-white text-slate-600 border-slate-300 hover:border-navy"
                    }`}
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

      {/* Participantes */}
      <Section title="Participantes / Inscritos">
        <div className="space-y-2">
          {participantes.map((p, i) => (
            <div
              key={i}
              className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center rounded-lg border border-slate-200 p-2"
            >
              <input
                className="input md:col-span-3"
                placeholder="Nome"
                value={p.nome}
                onChange={(e) => updParticipante(i, { nome: e.target.value })}
              />
              <select
                className="input md:col-span-2"
                value={p.tipo}
                onChange={(e) => updParticipante(i, { tipo: e.target.value })}
              >
                <option value="B2C">B2C</option>
                <option value="B2B">B2B</option>
              </select>
              <input
                className="input md:col-span-3"
                placeholder="Empresa / Origem"
                value={p.origem}
                onChange={(e) => updParticipante(i, { origem: e.target.value })}
              />
              <input
                className="input md:col-span-2"
                placeholder="Email"
                value={p.email}
                onChange={(e) => updParticipante(i, { email: e.target.value })}
              />
              <label className="flex items-center gap-1 text-xs text-slate-600 md:col-span-1">
                <input
                  type="checkbox"
                  checked={p.concluido}
                  onChange={(e) => updParticipante(i, { concluido: e.target.checked })}
                />
                Concl.
              </label>
              <button
                type="button"
                onClick={() => rmParticipante(i)}
                className="text-red-600 text-sm md:col-span-1 hover:underline"
              >
                Remover
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addParticipante}
            className="rounded-lg bg-brand-50 text-brand-700 px-3 py-2 text-sm font-medium hover:bg-brand-100"
          >
            + Adicionar participante
          </button>
        </div>
      </Section>

      {/* Financeiro */}
      <Section title="Financeiro & ROI">
        {rubricas.length === 0 ? (
          <p className="text-sm text-slate-400">
            Nenhuma rubrica cadastrada. Adicione rubricas de receita/custo em Cadastros.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-slate-500 text-left">
                <tr>
                  <th className="py-2 font-medium">Rubrica</th>
                  <th className="py-2 font-medium w-40">Previsto (AOA)</th>
                  <th className="py-2 font-medium w-40">Realizado (AOA)</th>
                </tr>
              </thead>
              <tbody>
                {receitas.length > 0 && (
                  <tr>
                    <td colSpan={3} className="pt-3 pb-1 text-xs font-semibold text-brand-700 uppercase">
                      Receitas
                    </td>
                  </tr>
                )}
                {receitas.map((r) => (
                  <FinRow key={r.id} r={r} fin={fin} onChange={setFinValue} />
                ))}
                <tr>
                  <td colSpan={3} className="pt-3 pb-1 text-xs font-semibold text-slate-500 uppercase">
                    Custos
                  </td>
                </tr>
                {custos.map((r) => (
                  <FinRow key={r.id} r={r} fin={fin} onChange={setFinValue} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {/* Qualidade */}
      <Section title="Qualidade & Avaliação">
        <Grid>
          <Field label="NPS da Formação (meta ≥ 70)">
            <input className="input" type="number" step="0.1" value={form.nps}
              onChange={(e) => set("nps", e.target.value)} />
          </Field>
          <Field label="Taxa de Conclusão % (≥ 90)">
            <input className="input" type="number" step="0.1" value={form.taxaConclusao}
              onChange={(e) => set("taxaConclusao", e.target.value)} />
          </Field>
          <Field label="Taxa de Presença % (≥ 85)">
            <input className="input" type="number" step="0.1" value={form.taxaPresenca}
              onChange={(e) => set("taxaPresenca", e.target.value)} />
          </Field>
          <Field label="Taxa de Aprovação % (≥ 80)">
            <input className="input" type="number" step="0.1" value={form.taxaAprovacao}
              onChange={(e) => set("taxaAprovacao", e.target.value)} />
          </Field>
          <Field label="Aval. do Formador (≥ 4,3)">
            <input className="input" type="number" step="0.1" value={form.avalFormador}
              onChange={(e) => set("avalFormador", e.target.value)} />
          </Field>
          <Field label="Reclamações / Incidentes (meta 0)">
            <input className="input" type="number" step="1" value={form.reclamacoes}
              onChange={(e) => set("reclamacoes", e.target.value)} />
          </Field>
        </Grid>
        <p className="text-xs font-semibold text-slate-500 uppercase mt-4 mb-2">
          Avaliação por critério (NPS detalhado)
        </p>
        <Grid>
          <Field label="Conteúdo / Relevância">
            <input className="input" type="number" step="0.1" value={form.avConteudo}
              onChange={(e) => set("avConteudo", e.target.value)} />
          </Field>
          <Field label="Clareza do Formador">
            <input className="input" type="number" step="0.1" value={form.avClareza}
              onChange={(e) => set("avClareza", e.target.value)} />
          </Field>
          <Field label="Materiais de Apoio">
            <input className="input" type="number" step="0.1" value={form.avMateriais}
              onChange={(e) => set("avMateriais", e.target.value)} />
          </Field>
          <Field label="Organização / Logística">
            <input className="input" type="number" step="0.1" value={form.avOrganizacao}
              onChange={(e) => set("avOrganizacao", e.target.value)} />
          </Field>
          <Field label="Aplicabilidade Prática">
            <input className="input" type="number" step="0.1" value={form.avAplicabilidade}
              onChange={(e) => set("avAplicabilidade", e.target.value)} />
          </Field>
        </Grid>
        <Grid>
          <Field label="Comentários / Observações" full>
            <textarea className="input" rows={3} value={form.comentarios}
              onChange={(e) => set("comentarios", e.target.value)} />
          </Field>
          <Field label="Responsável Pedagógica" full>
            <input className="input" value={form.responsavelPedagogica}
              onChange={(e) => set("responsavelPedagogica", e.target.value)} />
          </Field>
        </Grid>
      </Section>

      <div className="flex gap-2 sticky bottom-0 bg-slate-100 py-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="rounded-lg bg-white border border-slate-300 px-5 py-2 text-sm font-medium hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-navy text-white px-6 py-2 text-sm font-semibold hover:bg-navy-light disabled:opacity-60"
        >
          {saving ? "Salvando…" : initial ? "Guardar alterações" : "Criar projecto"}
        </button>
      </div>

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
      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">
        AOA
      </span>
      <input
        className="input text-right"
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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="bg-navy text-white px-5 py-3 font-semibold">{title}</div>
      <div className="p-5">{children}</div>
    </div>
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
      <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
      {children}
    </div>
  );
}
