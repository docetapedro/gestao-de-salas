"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import DatePicker from "@/components/DatePicker";
import {
  CalendarPlus,
  ChevronDown,
  Download,
  FileDown,
  Plus,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import {
  ESTADOS_TURMA,
  ESTADO_TURMA_BADGE,
  ESTADO_TURMA_LABEL,
  ESTADOS_INSCRICAO,
  PRIORIDADES,
  COMPETENCIAS,
  TIPOS_ACCAO,
  MODALIDADES,
  normalizar,
  type EstadoTurma,
} from "@/lib/plano-formativo";

/* ------------------------------ Tipos ------------------------------------ */
type Colaborador = {
  id: string;
  nome: string;
  funcao: string | null;
  direcao: string | null;
  area: string | null;
  liderancaDirecta: string | null;
};
type FormacaoLite = {
  id: string;
  nome: string;
  competencia: string | null;
  tipoAccao: string | null;
  pilar: string | null;
  area: string | null;
};
type Inscricao = {
  id: string;
  prioridade: string | null;
  motivo: string | null;
  estado: string;
  turmaId: string | null;
  colaborador: Colaborador;
  formacao: FormacaoLite;
};
type Turma = {
  id: string;
  codigo: string | null;
  estado: EstadoTurma;
  entidade: string | null;
  formador: string | null;
  local: string | null;
  modalidade: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  notas: string | null;
  _count: { inscricoes: number };
};
type Formacao = FormacaoLite & {
  entidadeSugerida: string | null;
  inscricoesCount: number;
  turmas: Turma[];
};
type Plano = { id: string; ano: number; titulo: string | null };

const TODOS = "__todos__";
const SEM_TURMA = "__none__";
const ymd = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

/* ============================ Componente ================================== */
export default function PlanoFormativoClient({ canManage }: { canManage: boolean }) {
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [ano, setAno] = useState<number | null>(null);
  const [planoId, setPlanoId] = useState<string | null>(null);
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [formacoes, setFormacoes] = useState<Formacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [novoAno, setNovoAno] = useState(false);

  async function reload(targetAno?: number | null) {
    try {
      const qs = targetAno ? `?ano=${targetAno}` : "";
      const data = await api<{
        planos: Plano[];
        ano: number | null;
        planoId: string | null;
        inscricoes: Inscricao[];
        formacoes: Formacao[];
      }>(`/api/plano-formativo${qs}`);
      setPlanos(data.planos);
      setAno(data.ano);
      setPlanoId(data.planoId);
      setInscricoes(data.inscricoes);
      setFormacoes(data.formacoes);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    reload();
  }, []);

  if (loading)
    return <div className="py-16 text-center text-slate-400">A carregar…</div>;
  if (error)
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
        {error}
      </div>
    );

  return (
    <div className="space-y-4">
      {/* Barra do ano + acções globais */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-sm text-slate-500">Ano do plano</Label>
          {planos.length > 0 ? (
            <Select value={ano ? String(ano) : undefined} onValueChange={(v) => reload(Number(v))}>
              <SelectTrigger className="w-[120px] font-semibold">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {planos.map((p) => (
                  <SelectItem key={p.id} value={String(p.ano)}>
                    {p.ano}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm text-slate-400">— sem planos —</span>
          )}
        </div>
        {canManage && (
          <Button variant="outline" size="sm" onClick={() => setNovoAno(true)}>
            <CalendarPlus className="h-4 w-4" /> Novo ano
          </Button>
        )}
        <div className="ml-auto flex gap-2">
          <Button variant="outline" asChild>
            <a href="/api/plano-formativo/template" download>
              <FileDown className="h-4 w-4" /> Baixar template
            </a>
          </Button>
          {planoId && (
            <Button variant="outline" asChild>
              <a href={`/api/plano-formativo/export?ano=${ano}`} download>
                <Download className="h-4 w-4" /> Exportar Excel
              </a>
            </Button>
          )}
        </div>
      </div>

      {planoId ? (
        <Tabs defaultValue="plano">
          <TabsList>
            <TabsTrigger value="plano">Plano geral</TabsTrigger>
            <TabsTrigger value="turmas">Formações &amp; Turmas</TabsTrigger>
            <TabsTrigger value="resumo">Resumo</TabsTrigger>
          </TabsList>

          <TabsContent value="plano">
            <PlanoGeral
              inscricoes={inscricoes}
              formacoes={formacoes}
              canManage={canManage}
              planoId={planoId}
              onChanged={() => reload(ano)}
            />
          </TabsContent>

          <TabsContent value="turmas">
            <FormacoesTurmas
              formacoes={formacoes}
              inscricoes={inscricoes}
              canManage={canManage}
              planoId={planoId}
              onChanged={() => reload(ano)}
            />
          </TabsContent>

          <TabsContent value="resumo">
            <Resumo inscricoes={inscricoes} formacoes={formacoes} />
          </TabsContent>
        </Tabs>
      ) : (
        <Card>
          <CardContent className="py-16 text-center text-slate-500">
            <p className="mb-3">Ainda não existe nenhum plano anual.</p>
            {canManage && (
              <Button variant="navy" onClick={() => setNovoAno(true)}>
                <CalendarPlus className="h-4 w-4" /> Criar plano do ano
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {novoAno && (
        <NovoAnoDialog
          anosExistentes={planos.map((p) => p.ano)}
          onClose={() => setNovoAno(false)}
          onSaved={(a) => {
            setNovoAno(false);
            reload(a);
          }}
        />
      )}
    </div>
  );
}

/* --------------------------- Plano geral --------------------------------- */
function PlanoGeral({
  inscricoes,
  formacoes,
  canManage,
  planoId,
  onChanged,
}: {
  inscricoes: Inscricao[];
  formacoes: Formacao[];
  canManage: boolean;
  planoId: string;
  onChanged: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [direcao, setDirecao] = useState(TODOS);
  const [prioridade, setPrioridade] = useState(TODOS);
  const [competencia, setCompetencia] = useState(TODOS);
  const [estado, setEstado] = useState(TODOS);
  const [addOpen, setAddOpen] = useState(false);

  const direcoes = useMemo(
    () =>
      Array.from(
        new Set(inscricoes.map((i) => i.colaborador.direcao).filter(Boolean))
      ).sort() as string[],
    [inscricoes]
  );

  const filtradas = useMemo(() => {
    const q = normalizar(busca);
    return inscricoes.filter((i) => {
      if (q && !normalizar(i.colaborador.nome).includes(q)) return false;
      if (direcao !== TODOS && i.colaborador.direcao !== direcao) return false;
      if (prioridade !== TODOS && (i.prioridade ?? "") !== prioridade) return false;
      if (competencia !== TODOS && (i.formacao.competencia ?? "") !== competencia)
        return false;
      if (estado !== TODOS && i.estado !== estado) return false;
      return true;
    });
  }, [inscricoes, busca, direcao, prioridade, competencia, estado]);

  async function patch(id: string, body: Record<string, unknown>) {
    try {
      await api(`/api/plano-formativo/inscricoes/${id}`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 py-4">
          <div className="relative min-w-[200px] flex-1">
            <Label className="mb-1 block text-xs">Pesquisar colaborador</Label>
            <Search className="pointer-events-none absolute left-2.5 top-[34px] h-4 w-4 text-slate-400" />
            <Input
              className="pl-8"
              placeholder="Nome (ignora acentos)…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <FiltroSelect label="Direcção" value={direcao} onChange={setDirecao} options={direcoes} />
          <FiltroSelect
            label="Prioridade"
            value={prioridade}
            onChange={setPrioridade}
            options={[...PRIORIDADES]}
          />
          <FiltroSelect
            label="Competência"
            value={competencia}
            onChange={setCompetencia}
            options={[...COMPETENCIAS]}
          />
          <FiltroSelect
            label="Estado"
            value={estado}
            onChange={setEstado}
            options={ESTADOS_INSCRICAO.map((e) => e.value)}
            labels={Object.fromEntries(ESTADOS_INSCRICAO.map((e) => [e.value, e.label]))}
          />
          {canManage && (
            <Button variant="navy" onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Necessidade
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="text-sm text-slate-500">
        {filtradas.length} de {inscricoes.length} inscrições
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Colaborador</TableHead>
                <TableHead>Direcção / Área</TableHead>
                <TableHead>Formação</TableHead>
                <TableHead>Comp.</TableHead>
                <TableHead>Prioridade</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.map((i) => (
                <TableRow key={i.id}>
                  <TableCell>
                    <div className="font-medium text-slate-800">{i.colaborador.nome}</div>
                    <div className="text-xs text-slate-400">{i.colaborador.funcao ?? "—"}</div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    <div>{i.colaborador.direcao ?? "—"}</div>
                    <div className="text-xs text-slate-400">{i.colaborador.area ?? ""}</div>
                  </TableCell>
                  <TableCell className="max-w-[280px]">
                    <div className="text-sm text-slate-800">{i.formacao.nome}</div>
                    {i.turmaId && (
                      <span className="text-[11px] text-brand-600">● alocado a turma</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {i.formacao.competencia ? (
                      <Badge variant="secondary">{i.formacao.competencia}</Badge>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {canManage ? (
                      <InlineSelect
                        value={i.prioridade ?? ""}
                        placeholder="—"
                        options={[...PRIORIDADES]}
                        onChange={(v) => patch(i.id, { prioridade: v })}
                      />
                    ) : (
                      i.prioridade ?? "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {canManage ? (
                      <InlineSelect
                        value={i.estado}
                        options={ESTADOS_INSCRICAO.map((e) => e.value)}
                        labels={Object.fromEntries(
                          ESTADOS_INSCRICAO.map((e) => [e.value, e.label])
                        )}
                        onChange={(v) => patch(i.id, { estado: v })}
                      />
                    ) : (
                      <Badge
                        className={
                          ESTADOS_INSCRICAO.find((e) => e.value === i.estado)?.badge
                        }
                      >
                        {ESTADOS_INSCRICAO.find((e) => e.value === i.estado)?.label}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {filtradas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-slate-400">
                    Sem inscrições para os filtros escolhidos.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {addOpen && (
        <AddNecessidadeDialog
          formacoes={formacoes}
          planoId={planoId}
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------ Formações & Turmas ----------------------------- */
function FormacoesTurmas({
  formacoes,
  inscricoes,
  canManage,
  planoId,
  onChanged,
}: {
  formacoes: Formacao[];
  inscricoes: Inscricao[];
  canManage: boolean;
  planoId: string;
  onChanged: () => void;
}) {
  const [aberta, setAberta] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [turmaDialog, setTurmaDialog] = useState<{
    formacao: Formacao;
    turma: Turma | null;
  } | null>(null);

  const porFormacao = useMemo(() => {
    const m = new Map<string, Inscricao[]>();
    for (const i of inscricoes) {
      const arr = m.get(i.formacao.id) ?? [];
      arr.push(i);
      m.set(i.formacao.id, arr);
    }
    return m;
  }, [inscricoes]);

  // Só as formações com necessidades ou turmas NESTE ano (+ filtro de pesquisa).
  const lista = useMemo(() => {
    const q = normalizar(busca);
    return formacoes.filter(
      (f) =>
        (f.inscricoesCount > 0 || f.turmas.length > 0) &&
        (!q || normalizar(f.nome).includes(q))
    );
  }, [formacoes, busca]);

  async function allocate(inscricaoId: string, turmaId: string | null) {
    try {
      await api(`/api/plano-formativo/inscricoes/${inscricaoId}`, {
        method: "PATCH",
        body: JSON.stringify({ turmaId }),
      });
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function apagarTurma(id: string) {
    if (!confirm("Apagar esta turma? As inscrições alocadas voltam a 'sem turma'.")) return;
    try {
      await api(`/api/plano-formativo/turmas/${id}`, { method: "DELETE" });
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          className="pl-8"
          placeholder="Procurar formação…"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
      </div>

      {lista.map((f) => {
        const insc = porFormacao.get(f.id) ?? [];
        const isOpen = aberta === f.id;
        return (
          <Card key={f.id}>
            <button
              type="button"
              onClick={() => setAberta(isOpen ? null : f.id)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-slate-800">{f.nome}</div>
                <div className="mt-0.5 flex flex-wrap gap-1.5">
                  {f.competencia && <Badge variant="secondary">{f.competencia}</Badge>}
                  {f.tipoAccao && <Badge variant="outline">{f.tipoAccao}</Badge>}
                  {f.pilar && <Badge variant="outline">{f.pilar}</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {f.inscricoesCount}
                </span>
                <span>{f.turmas.length} turma(s)</span>
              </div>
            </button>

            {isOpen && (
              <CardContent className="space-y-4 border-t border-slate-100 pt-4">
                {/* Turmas */}
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-slate-700">Turmas</h4>
                  {canManage && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTurmaDialog({ formacao: f, turma: null })}
                    >
                      <Plus className="h-4 w-4" /> Nova turma
                    </Button>
                  )}
                </div>
                {f.turmas.length === 0 ? (
                  <p className="text-sm text-slate-400">
                    Ainda sem turmas. Cria uma para organizar os formandos, o fornecedor e as datas.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {f.turmas.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-lg border border-slate-200 p-3 text-sm"
                      >
                        <div className="mb-1 flex items-center justify-between gap-2">
                          <span className="font-medium text-slate-800">
                            {t.codigo || "Turma"}
                          </span>
                          <Badge className={ESTADO_TURMA_BADGE[t.estado]}>
                            {ESTADO_TURMA_LABEL[t.estado]}
                          </Badge>
                        </div>
                        <dl className="space-y-0.5 text-xs text-slate-500">
                          <div>Fornecedor: {t.entidade || "—"}</div>
                          <div>Formador: {t.formador || "—"}</div>
                          <div>Local: {t.local || "—"}</div>
                          <div>
                            Datas:{" "}
                            {t.dataInicio
                              ? new Date(t.dataInicio).toLocaleDateString("pt-PT")
                              : "—"}
                            {t.dataFim
                              ? ` → ${new Date(t.dataFim).toLocaleDateString("pt-PT")}`
                              : ""}
                          </div>
                          <div>Formandos: {t._count.inscricoes}</div>
                        </dl>
                        {canManage && (
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setTurmaDialog({ formacao: f, turma: t })}
                            >
                              Editar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => apagarTurma(t.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Inscritos + alocação a turma */}
                <div>
                  <h4 className="mb-2 text-sm font-semibold text-slate-700">
                    Formandos ({insc.length})
                  </h4>
                  <div className="overflow-x-auto rounded-lg border border-slate-200">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Direcção</TableHead>
                          <TableHead>Prioridade</TableHead>
                          <TableHead className="w-[180px]">Turma</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {insc.map((i) => (
                          <TableRow key={i.id}>
                            <TableCell className="text-sm text-slate-800">
                              {i.colaborador.nome}
                            </TableCell>
                            <TableCell className="text-xs text-slate-500">
                              {i.colaborador.direcao ?? "—"}
                            </TableCell>
                            <TableCell className="text-xs">{i.prioridade ?? "—"}</TableCell>
                            <TableCell>
                              {canManage ? (
                                <Select
                                  value={i.turmaId ?? SEM_TURMA}
                                  onValueChange={(v) =>
                                    allocate(i.id, v === SEM_TURMA ? null : v)
                                  }
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value={SEM_TURMA}>— Sem turma —</SelectItem>
                                    {f.turmas.map((t) => (
                                      <SelectItem key={t.id} value={t.id}>
                                        {t.codigo || "Turma"} ({ESTADO_TURMA_LABEL[t.estado]})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : i.turmaId ? (
                                f.turmas.find((t) => t.id === i.turmaId)?.codigo || "Turma"
                              ) : (
                                "—"
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        );
      })}

      {turmaDialog && (
        <TurmaDialog
          formacao={turmaDialog.formacao}
          turma={turmaDialog.turma}
          planoId={planoId}
          onClose={() => setTurmaDialog(null)}
          onSaved={() => {
            setTurmaDialog(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

/* ------------------------------- Resumo ---------------------------------- */
function Resumo({
  inscricoes,
  formacoes,
}: {
  inscricoes: Inscricao[];
  formacoes: Formacao[];
}) {
  const totalFormandos = inscricoes.length;
  const totalFormacoes = formacoes.length;
  const totalTurmas = formacoes.reduce((s, f) => s + f.turmas.length, 0);

  const conta = (fn: (i: Inscricao) => string | null) => {
    const m = new Map<string, number>();
    for (const i of inscricoes) {
      const k = fn(i) ?? "(não definido)";
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };

  const porDirecao = conta((i) => i.colaborador.direcao);
  const porCompetencia = conta((i) => i.formacao.competencia);
  const porPilar = conta((i) => i.formacao.pilar);

  // Progresso por estado de turma.
  const estadoTurmas = new Map<EstadoTurma, number>();
  for (const f of formacoes)
    for (const t of f.turmas)
      estadoTurmas.set(t.estado, (estadoTurmas.get(t.estado) ?? 0) + 1);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Total de formandos" value={totalFormandos} />
        <Kpi label="Formações" value={totalFormacoes} />
        <Kpi label="Turmas" value={totalTurmas} />
      </div>

      <Card>
        <CardContent className="py-4">
          <h4 className="mb-3 text-sm font-semibold text-slate-700">
            Turmas por estado (execução)
          </h4>
          <div className="flex flex-wrap gap-2">
            {ESTADOS_TURMA.map((e) => (
              <span
                key={e.value}
                className={`rounded-full px-3 py-1 text-sm ${e.badge}`}
              >
                {e.label}: <b>{estadoTurmas.get(e.value) ?? 0}</b>
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Quebra titulo="Por direcção" dados={porDirecao} />
        <Quebra titulo="Por competência" dados={porCompetencia} />
        <Quebra titulo="Por pilar estratégico" dados={porPilar} />
      </div>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="py-5">
        <div className="text-3xl font-bold text-navy">{value}</div>
        <div className="text-sm text-slate-500">{label}</div>
      </CardContent>
    </Card>
  );
}

function Quebra({ titulo, dados }: { titulo: string; dados: [string, number][] }) {
  const max = Math.max(1, ...dados.map((d) => d[1]));
  return (
    <Card>
      <CardContent className="py-4">
        <h4 className="mb-3 text-sm font-semibold text-slate-700">{titulo}</h4>
        <div className="space-y-2">
          {dados.map(([k, v]) => (
            <div key={k}>
              <div className="mb-0.5 flex justify-between text-xs text-slate-600">
                <span className="truncate pr-2">{k}</span>
                <span className="font-medium">{v}</span>
              </div>
              <div className="h-1.5 rounded-full bg-slate-100">
                <div
                  className="h-1.5 rounded-full bg-brand-500"
                  style={{ width: `${(v / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
          {dados.length === 0 && <p className="text-sm text-slate-400">Sem dados.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

/* ----------------------------- Auxiliares -------------------------------- */
function FiltroSelect({
  label,
  value,
  onChange,
  options,
  labels,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <div>
      <Label className="mb-1 block text-xs">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-[150px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todas</SelectItem>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {labels?.[o] ?? o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function InlineSelect({
  value,
  options,
  labels,
  placeholder,
  onChange,
}: {
  value: string;
  options: string[];
  labels?: Record<string, string>;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select value={value || undefined} onValueChange={onChange}>
      <SelectTrigger className="h-8 w-[130px] text-xs">
        <SelectValue placeholder={placeholder ?? "—"} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {labels?.[o] ?? o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ----------------------- Dialog: nova necessidade ------------------------ */
function AddNecessidadeDialog({
  formacoes,
  planoId,
  onClose,
  onSaved,
}: {
  formacoes: Formacao[];
  planoId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState("");
  const [funcao, setFuncao] = useState("");
  const [direcao, setDirecao] = useState("");
  const [area, setArea] = useState("");
  const [formacaoId, setFormacaoId] = useState("");
  const [prioridade, setPrioridade] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!nome.trim() || !formacaoId) {
      toast.error("Nome e formação são obrigatórios");
      return;
    }
    setSaving(true);
    try {
      await api("/api/plano-formativo/inscricoes", {
        method: "POST",
        body: JSON.stringify({
          planoId,
          nome,
          funcao,
          direcao,
          area,
          formacaoId,
          prioridade: prioridade || null,
          motivo,
        }),
      });
      toast.success("Necessidade adicionada");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova necessidade de formação</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1 block">Colaborador *</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="mb-1 block">Função</Label>
              <Input value={funcao} onChange={(e) => setFuncao(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block">Direcção</Label>
              <Input value={direcao} onChange={(e) => setDirecao(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="mb-1 block">Área</Label>
            <Input value={area} onChange={(e) => setArea(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block">Formação *</Label>
            <Select value={formacaoId} onValueChange={setFormacaoId}>
              <SelectTrigger>
                <SelectValue placeholder="Escolher formação…" />
              </SelectTrigger>
              <SelectContent>
                {formacoes.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    {f.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block">Prioridade</Label>
            <Select value={prioridade || undefined} onValueChange={setPrioridade}>
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {PRIORIDADES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block">Motivo (porquê?)</Label>
            <Textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="navy" disabled={saving} onClick={submit}>
            {saving ? "A guardar…" : "Adicionar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------- Dialog: criar/editar turma -------------------- */
function TurmaDialog({
  formacao,
  turma,
  planoId,
  onClose,
  onSaved,
}: {
  formacao: Formacao;
  turma: Turma | null;
  planoId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [codigo, setCodigo] = useState(turma?.codigo ?? "");
  const [estado, setEstado] = useState<EstadoTurma>(turma?.estado ?? "PLANEADO");
  const [entidade, setEntidade] = useState(turma?.entidade ?? formacao.entidadeSugerida ?? "");
  const [formador, setFormador] = useState(turma?.formador ?? "");
  const [local, setLocal] = useState(turma?.local ?? "");
  const [modalidade, setModalidade] = useState(turma?.modalidade ?? "");
  const [dataInicio, setDataInicio] = useState(ymd(turma?.dataInicio ?? null));
  const [dataFim, setDataFim] = useState(ymd(turma?.dataFim ?? null));
  const [notas, setNotas] = useState(turma?.notas ?? "");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    const body = {
      planoId,
      formacaoId: formacao.id,
      codigo,
      estado,
      entidade,
      formador,
      local,
      modalidade: modalidade || null,
      dataInicio: dataInicio || null,
      dataFim: dataFim || null,
      notas,
    };
    try {
      if (turma) {
        await api(`/api/plano-formativo/turmas/${turma.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        });
      } else {
        await api("/api/plano-formativo/turmas", {
          method: "POST",
          body: JSON.stringify(body),
        });
      }
      toast.success(turma ? "Turma actualizada" : "Turma criada");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {turma ? "Editar turma" : "Nova turma"} — {formacao.nome}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="mb-1 block">Código / nome</Label>
            <Input value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="T1, 2026-Q1…" />
          </div>
          <div>
            <Label className="mb-1 block">Estado</Label>
            <Select value={estado} onValueChange={(v) => setEstado(v as EstadoTurma)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS_TURMA.map((e) => (
                  <SelectItem key={e.value} value={e.value}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block">Fornecedor / entidade</Label>
            <Input value={entidade} onChange={(e) => setEntidade(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block">Formador</Label>
            <Input value={formador} onChange={(e) => setFormador(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block">Local / sala</Label>
            <Input value={local} onChange={(e) => setLocal(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block">Modalidade</Label>
            <Select value={modalidade || undefined} onValueChange={setModalidade}>
              <SelectTrigger>
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {MODALIDADES.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block">Início</Label>
            <DatePicker value={dataInicio} onChange={setDataInicio} />
          </div>
          <div>
            <Label className="mb-1 block">Fim</Label>
            <DatePicker value={dataFim} onChange={setDataFim} />
          </div>
          <div className="col-span-2">
            <Label className="mb-1 block">Notas</Label>
            <Textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="navy" disabled={saving} onClick={submit}>
            {saving ? "A guardar…" : turma ? "Guardar" : "Criar turma"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------- Dialog: novo ano/plano ------------------------ */
function NovoAnoDialog({
  anosExistentes,
  onClose,
  onSaved,
}: {
  anosExistentes: number[];
  onClose: () => void;
  onSaved: (ano: number) => void;
}) {
  // Sugere o ano seguinte ao mais recente (ou o próximo se não houver planos).
  const sugestao =
    anosExistentes.length > 0 ? Math.max(...anosExistentes) + 1 : new Date().getFullYear();
  const [ano, setAno] = useState(String(sugestao));
  const [titulo, setTitulo] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    const n = Number(ano);
    if (!Number.isInteger(n) || n < 2000 || n > 2100) {
      toast.error("Ano inválido");
      return;
    }
    if (anosExistentes.includes(n)) {
      toast.error(`Já existe o plano de ${n}`);
      return;
    }
    setSaving(true);
    try {
      await api("/api/plano-formativo/planos", {
        method: "POST",
        body: JSON.stringify({ ano: n, titulo }),
      });
      toast.success(`Plano de ${n} criado`);
      onSaved(n);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Novo plano anual</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1 block">Ano *</Label>
            <Input
              type="number"
              value={ano}
              onChange={(e) => setAno(e.target.value)}
              min={2000}
              max={2100}
            />
          </div>
          <div>
            <Label className="mb-1 block">Título (opcional)</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="ex.: Plano Formativo 2027"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="navy" disabled={saving} onClick={submit}>
            {saving ? "A criar…" : "Criar plano"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
