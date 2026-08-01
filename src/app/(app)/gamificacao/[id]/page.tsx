"use client";

import {
  type CSSProperties,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Modal, ConfirmDialog } from "@/components/Modal";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Check,
  Copy,
  Crown,
  Gamepad2,
  KeyRound,
  ListChecks,
  Lock,
  Maximize,
  Medal,
  Megaphone,
  Pencil,
  Plus,
  QrCode,
  Radio,
  RotateCcw,
  Save,
  Sparkles,
  Timer,
  Trash2,
  Trophy,
  Users,
  UserPlus,
  X,
} from "lucide-react";
import QRCode from "qrcode";

// Paleta (cliente) — igual à sugerida no servidor, para escolher cores de equipa.
const CORES = [
  "#2563eb", "#dc2626", "#16a34a", "#f59e0b", "#7c3aed",
  "#db2777", "#0891b2", "#ea580c", "#4d7c0f", "#0f766e",
];

type Membro = { id: string; nome: string };
type Equipa = {
  id: string;
  nome: string;
  cor: string;
  lema: string | null;
  ordem: number;
  membros: Membro[];
};
type Classificacao = { id: string; equipaId: string; pontos: number };
type QuizOpcao = { id: string; texto: string; correta: boolean };
type QuizPergunta = { id: string; enunciado: string; opcoes: QuizOpcao[] };
type QuizSubmissao = {
  id: string;
  nomeMembro: string;
  equipaId: string;
  certas: number;
  totalPerguntas: number;
  pontos: number;
};
type TesouroCartao = {
  id: string;
  codigo: string;
  etiqueta: string | null;
  equipaId: string | null;
  introduzidoEm: string | null;
  introduzidoPorEquipaId: string | null;
};
type GritoVoto = {
  id: string;
  votanteEquipaId: string;
  votadaEquipaId: string;
};
type Dinamica = {
  id: string;
  nome: string;
  descricao: string | null;
  peso: number;
  ordem: number;
  tipo: string; // "manual" | "quiz" | "tesouro" | "grito"
  quizAberto: boolean;
  valorPorAcerto: number;
  bonusRapidezMax: number;
  tempoLimiteSeg: number | null;
  valorPorVoto: number;
  valorTesouro: number;
  tesouroVencedorEquipaId: string | null;
  tesouroVencedor: { id: string; nome: string; cor: string } | null;
  classificacoes: Classificacao[];
  perguntas: QuizPergunta[];
  submissoes: QuizSubmissao[];
  cartoesTesouro: TesouroCartao[];
  votos: GritoVoto[];
};
type Evento = {
  id: string;
  nome: string;
  descricao: string | null;
  local: string | null;
  data: string | null;
  ativo: boolean;
  equipas: Equipa[];
  dinamicas: Dinamica[];
  // Participantes pré-cadastrados ainda sem equipa.
  membros: Membro[];
};
type LinhaRanking = {
  equipaId: string;
  nome: string;
  cor: string;
  lema: string | null;
  total: number;
  vitorias: number;
  dinamicasPontuadas: number;
  posicao: number;
};

const cellKey = (dinamicaId: string, equipaId: string) =>
  `${dinamicaId}:${equipaId}`;

function nf(n: number) {
  return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 }).format(n);
}

export default function EventoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [evento, setEvento] = useState<Evento | null>(null);
  const [ranking, setRanking] = useState<LinhaRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("equipas");

  async function carregar() {
    try {
      const d = await api<{ evento: Evento; ranking: LinhaRanking[] }>(
        `/api/gamificacao/eventos/${id}`
      );
      setEvento(d.evento);
      setRanking(d.ranking);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return <div className="p-10 text-center text-slate-400">Carregando…</div>;
  }
  if (!evento) {
    return (
      <div className="p-10 text-center text-slate-400">
        Evento não encontrado.{" "}
        <Link href="/gamificacao" className="text-brand-600 hover:underline">
          Voltar
        </Link>
      </div>
    );
  }

  return (
    <div>
      {/* Cabeçalho */}
      <div className="mb-5">
        <Link
          href="/gamificacao"
          className="mb-2 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-navy"
        >
          <ArrowLeft className="h-4 w-4" /> Eventos
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-navy">{evento.nome}</h1>
            <p className="text-sm text-muted-foreground">
              {evento.equipas.length} equipas · {evento.dinamicas.length}{" "}
              dinâmicas
              {evento.local ? ` · ${evento.local}` : ""}
            </p>
          </div>
          <Button asChild variant="navy">
            <Link href={`/gamificacao/${id}/ranking`}>
              <Trophy /> Abrir ecrã de ranking
            </Link>
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="equipas">
            <Users /> Equipas
          </TabsTrigger>
          <TabsTrigger value="participantes">
            <UserPlus /> Participantes
          </TabsTrigger>
          <TabsTrigger value="dinamicas">
            <Gamepad2 /> Dinâmicas
          </TabsTrigger>
          <TabsTrigger value="pontos">
            <Save /> Lançar pontos
          </TabsTrigger>
          <TabsTrigger value="ranking">
            <Trophy /> Ranking
          </TabsTrigger>
        </TabsList>

        <TabsContent value="equipas">
          <EquipasTab evento={evento} onChange={carregar} />
        </TabsContent>
        <TabsContent value="participantes">
          <ParticipantesTab evento={evento} onChange={carregar} />
        </TabsContent>
        <TabsContent value="dinamicas">
          <DinamicasTab evento={evento} onChange={carregar} />
        </TabsContent>
        <TabsContent value="pontos">
          <PontosTab evento={evento} onSaved={carregar} />
        </TabsContent>
        <TabsContent value="ranking">
          <RankingTab eventoId={id} ranking={ranking} onChange={carregar} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================== Equipas ================================== */

function EquipasTab({
  evento,
  onChange,
}: {
  evento: Evento;
  onChange: () => void;
}) {
  const [modal, setModal] = useState<null | Equipa | {}>(null);
  const [remover, setRemover] = useState<Equipa | null>(null);
  const [busy, setBusy] = useState(false);

  async function excluir() {
    if (!remover) return;
    setBusy(true);
    try {
      await api(`/api/gamificacao/equipas/${remover.id}`, { method: "DELETE" });
      toast.success("Equipa eliminada");
      setRemover(null);
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button variant="navy" size="sm" onClick={() => setModal({})}>
          <Plus /> Nova equipa
        </Button>
      </div>

      {evento.equipas.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-slate-400">
            Ainda não há equipas. Cria a primeira para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {evento.equipas.map((eq) => (
            <Card key={eq.id} className="group overflow-hidden">
              <div className="h-2 w-full" style={{ background: eq.cor }} />
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
                      style={{ background: eq.cor }}
                    >
                      {eq.nome.slice(0, 2).toUpperCase()}
                    </span>
                    <div>
                      <p className="font-semibold text-navy">{eq.nome}</p>
                      {eq.lema && (
                        <p className="text-xs italic text-slate-400">
                          “{eq.lema}”
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setModal(eq)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setRemover(eq)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {eq.membros.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {eq.membros.map((m) => (
                      <Badge key={m.id} variant="secondary" className="font-normal">
                        {m.nome}
                      </Badge>
                    ))}
                  </div>
                )}
                <p className="mt-2 flex items-center gap-1 text-xs text-slate-400">
                  <Users className="h-3.5 w-3.5" />
                  {eq.membros.length}{" "}
                  {eq.membros.length === 1 ? "membro" : "membros"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <EquipaForm
          eventoId={evento.id}
          equipa={"id" in modal ? (modal as Equipa) : null}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            onChange();
          }}
        />
      )}
      {remover && (
        <ConfirmDialog
          title="Eliminar equipa"
          message={`Eliminar a equipa "${remover.nome}"? As suas pontuações serão apagadas.`}
          confirmLabel="Eliminar"
          danger
          busy={busy}
          onConfirm={excluir}
          onCancel={() => setRemover(null)}
        />
      )}
    </div>
  );
}

function EquipaForm({
  eventoId,
  equipa,
  onClose,
  onSaved,
}: {
  eventoId: string;
  equipa: Equipa | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(equipa?.nome ?? "");
  const [cor, setCor] = useState(equipa?.cor ?? CORES[0]);
  const [lema, setLema] = useState(equipa?.lema ?? "");
  const [membros, setMembros] = useState<string[]>(
    equipa?.membros.map((m) => m.nome) ?? []
  );
  const [saving, setSaving] = useState(false);

  function setMembro(i: number, v: string) {
    setMembros((ms) => ms.map((m, idx) => (idx === i ? v : m)));
  }

  async function salvar() {
    if (!nome.trim()) return;
    setSaving(true);
    try {
      const payload = {
        eventoId,
        nome: nome.trim(),
        cor,
        lema: lema.trim() || null,
        membros: membros.map((m) => m.trim()).filter(Boolean),
      };
      await api(
        equipa
          ? `/api/gamificacao/equipas/${equipa.id}`
          : "/api/gamificacao/equipas",
        { method: equipa ? "PUT" : "POST", body: JSON.stringify(payload) }
      );
      toast.success(equipa ? "Equipa actualizada" : "Equipa criada");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      title={equipa ? "Editar equipa" : "Nova equipa"}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="navy" onClick={salvar} disabled={saving || !nome.trim()}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <Label className="mb-1 block">Nome da equipa *</Label>
          <Input
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Os Titãs"
          />
        </div>
        <div>
          <Label className="mb-1 block">Cor</Label>
          <div className="flex flex-wrap items-center gap-2">
            {CORES.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCor(c)}
                className={`h-7 w-7 rounded-full transition ${
                  cor === c
                    ? "ring-2 ring-offset-2 ring-slate-400"
                    : "hover:scale-110"
                }`}
                style={{ background: c }}
                aria-label={c}
              />
            ))}
            <input
              type="color"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              className="h-7 w-9 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
              title="Cor personalizada"
            />
          </div>
        </div>
        <div>
          <Label className="mb-1 block">Lema (opcional)</Label>
          <Input
            value={lema}
            onChange={(e) => setLema(e.target.value)}
            placeholder="Ex.: Nunca desistir!"
          />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <Label>Membros</Label>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setMembros((ms) => [...ms, ""])}
            >
              <UserPlus className="h-4 w-4" /> Adicionar
            </Button>
          </div>
          {membros.length === 0 ? (
            <p className="text-xs text-slate-400">
              Sem membros (opcional). A pontuação é sempre por equipa.
            </p>
          ) : (
            <div className="space-y-2">
              {membros.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    value={m}
                    onChange={(e) => setMembro(i, e.target.value)}
                    placeholder={`Membro ${i + 1}`}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-9 w-9 shrink-0 text-destructive hover:text-destructive"
                    onClick={() =>
                      setMembros((ms) => ms.filter((_, idx) => idx !== i))
                    }
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* =========================== Participantes ============================== */

function ParticipantesTab({
  evento,
  onChange,
}: {
  evento: Evento;
  onChange: () => void;
}) {
  const [texto, setTexto] = useState("");
  const [adicionando, setAdicionando] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [confirmarLote, setConfirmarLote] = useState(false);
  const [eliminandoLote, setEliminandoLote] = useState(false);

  // Todos os participantes: os já em equipas + os que estão na "pool".
  const participantes = useMemo(() => {
    const atribuidos = evento.equipas.flatMap((eq) =>
      eq.membros.map((m) => ({
        id: m.id,
        nome: m.nome,
        equipaId: eq.id as string | null,
      }))
    );
    const semEquipa = evento.membros.map((m) => ({
      id: m.id,
      nome: m.nome,
      equipaId: null as string | null,
    }));
    return [...semEquipa, ...atribuidos].sort((a, b) =>
      a.nome.localeCompare(b.nome, "pt")
    );
  }, [evento.equipas, evento.membros]);

  const totalSemEquipa = evento.membros.length;

  // Selecção múltipla (para eliminar em lote). Só conta ids ainda existentes.
  const idsSelecionados = useMemo(
    () => participantes.map((p) => p.id).filter((id) => selecionados.has(id)),
    [participantes, selecionados]
  );
  const nSelecionados = idsSelecionados.length;
  const todosSelecionados =
    participantes.length > 0 && nSelecionados === participantes.length;

  function alternarUm(id: string) {
    setSelecionados((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  function alternarTodos() {
    setSelecionados(
      todosSelecionados ? new Set() : new Set(participantes.map((p) => p.id))
    );
  }

  async function adicionar() {
    const nomes = texto
      .split(/[\n,;]+/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (nomes.length === 0) return;
    setAdicionando(true);
    try {
      await api("/api/gamificacao/membros", {
        method: "POST",
        body: JSON.stringify({ eventoId: evento.id, nomes }),
      });
      toast.success(
        `${nomes.length} participante${nomes.length === 1 ? "" : "s"} adicionado${
          nomes.length === 1 ? "" : "s"
        }`
      );
      setTexto("");
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAdicionando(false);
    }
  }

  async function associar(membroId: string, equipaId: string | null) {
    setOcupado(membroId);
    try {
      await api(`/api/gamificacao/membros/${membroId}`, {
        method: "PATCH",
        body: JSON.stringify({ equipaId }),
      });
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  async function remover(membroId: string) {
    setOcupado(membroId);
    try {
      await api(`/api/gamificacao/membros/${membroId}`, { method: "DELETE" });
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setOcupado(null);
    }
  }

  async function eliminarSelecionados() {
    if (nSelecionados === 0) return;
    setEliminandoLote(true);
    try {
      const r = await api<{ apagados: number }>("/api/gamificacao/membros", {
        method: "DELETE",
        body: JSON.stringify({ eventoId: evento.id, ids: idsSelecionados }),
      });
      toast.success(
        `${r.apagados} participante${r.apagados === 1 ? "" : "s"} eliminado${
          r.apagados === 1 ? "" : "s"
        }`
      );
      setSelecionados(new Set());
      setConfirmarLote(false);
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setEliminandoLote(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Pré-cadastro em lote */}
      <Card>
        <CardContent className="p-4">
          <Label className="mb-1 block">Pré-cadastrar participantes</Label>
          <p className="mb-2 text-xs text-slate-400">
            Cola a lista de nomes (um por linha, ou separados por vírgula).
            Podes associá-los às equipas depois.
          </p>
          <Textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={4}
            placeholder={"Ana Silva\nBruno Costa\nCarla Dias"}
          />
          <div className="mt-2 flex justify-end">
            <Button
              variant="navy"
              size="sm"
              onClick={adicionar}
              disabled={adicionando || !texto.trim()}
            >
              <UserPlus className="h-4 w-4" />{" "}
              {adicionando ? "A adicionar…" : "Adicionar à lista"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Lista com associação a equipas */}
      {participantes.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-slate-400">
            Ainda não há participantes. Cola a lista acima para começar.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">
                  {participantes.length} participante
                  {participantes.length === 1 ? "" : "s"}
                </span>
                {totalSemEquipa > 0 && (
                  <Badge variant="secondary" className="font-normal">
                    {totalSemEquipa} sem equipa
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={alternarTodos}
                  disabled={participantes.length === 0}
                >
                  {todosSelecionados ? "Desmarcar todos" : "Selecionar todos"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700 disabled:text-slate-300"
                  onClick={() => setConfirmarLote(true)}
                  disabled={nSelecionados === 0}
                >
                  <Trash2 /> Eliminar
                  {nSelecionados > 0 ? ` (${nSelecionados})` : ""}
                </Button>
              </div>
            </div>

            {evento.equipas.length === 0 && (
              <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
                Ainda não há equipas. Cria equipas na aba “Equipas” para poderes
                associar os participantes.
              </div>
            )}

            <div className="space-y-1.5">
              {participantes.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                    selecionados.has(p.id) ? "bg-red-50" : "bg-slate-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selecionados.has(p.id)}
                    onChange={() => alternarUm(p.id)}
                    className="h-4 w-4 shrink-0 cursor-pointer accent-red-600"
                    title="Selecionar para eliminar"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-700">
                    {p.nome}
                  </span>
                  <select
                    value={p.equipaId ?? ""}
                    disabled={ocupado === p.id}
                    onChange={(e) =>
                      associar(p.id, e.target.value || null)
                    }
                    className="h-8 max-w-[45%] shrink-0 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-slate-400 disabled:opacity-50"
                  >
                    <option value="">— Sem equipa —</option>
                    {evento.equipas.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.nome}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    title="Remover participante"
                    disabled={ocupado === p.id}
                    onClick={() => remover(p.id)}
                    className="shrink-0 rounded-md p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {confirmarLote && (
        <ConfirmDialog
          title="Eliminar participantes selecionados?"
          message={`Vais eliminar ${nSelecionados} participante${
            nSelecionados === 1 ? "" : "s"
          } deste evento. Esta acção não pode ser anulada.`}
          confirmLabel="Eliminar"
          danger
          busy={eliminandoLote}
          onConfirm={eliminarSelecionados}
          onCancel={() => setConfirmarLote(false)}
        />
      )}
    </div>
  );
}

/* ============================= Dinâmicas ================================= */

function DinamicasTab({
  evento,
  onChange,
}: {
  evento: Evento;
  onChange: () => void;
}) {
  const [modal, setModal] = useState<null | Dinamica | {}>(null);
  const [remover, setRemover] = useState<Dinamica | null>(null);
  const [controlo, setControlo] = useState<Dinamica | null>(null);
  const [bau, setBau] = useState<Dinamica | null>(null);
  const [busy, setBusy] = useState(false);
  const [movendo, setMovendo] = useState(false);

  // Reordena: tira a dinâmica de `from` e insere-a em `to`, reindexa a lista
  // toda (ordem = posição) e grava na base de dados só as que mudaram.
  async function reordenar(from: number, to: number) {
    const lista = evento.dinamicas;
    if (
      movendo ||
      from === to ||
      from < 0 ||
      to < 0 ||
      from >= lista.length ||
      to >= lista.length
    )
      return;
    const nova = [...lista];
    const [item] = nova.splice(from, 1);
    nova.splice(to, 0, item);
    // Persiste apenas as dinâmicas cuja ordem (posição) mudou.
    const alteradas = nova
      .map((d, idx) => ({ d, idx }))
      .filter(({ d, idx }) => d.ordem !== idx);
    if (alteradas.length === 0) return;
    setMovendo(true);
    try {
      await Promise.all(
        alteradas.map(({ d, idx }) =>
          api(`/api/gamificacao/dinamicas/${d.id}`, {
            method: "PUT",
            body: JSON.stringify({ ordem: idx }),
          })
        )
      );
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setMovendo(false);
    }
  }

  async function excluir() {
    if (!remover) return;
    setBusy(true);
    try {
      await api(`/api/gamificacao/dinamicas/${remover.id}`, {
        method: "DELETE",
      });
      toast.success("Dinâmica eliminada");
      setRemover(null);
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <Button variant="navy" size="sm" onClick={() => setModal({})}>
          <Plus /> Nova dinâmica
        </Button>
      </div>

      {evento.dinamicas.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-slate-400">
            Ainda não há dinâmicas. Adiciona os desafios do team building.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {evento.dinamicas.map((d, i) => (
            <Card key={d.id} className="group">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex flex-col items-center gap-0.5">
                  <button
                    type="button"
                    title="Subir"
                    disabled={i === 0 || movendo}
                    onClick={() => reordenar(i, i - 1)}
                    className="rounded p-0.5 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  {/* Seletor de posição: saltar diretamente para outra ordem. */}
                  <select
                    value={i}
                    disabled={movendo || evento.dinamicas.length < 2}
                    onChange={(e) => reordenar(i, Number(e.target.value))}
                    title="Mudar para a posição…"
                    className="h-7 w-7 shrink-0 cursor-pointer appearance-none rounded-lg bg-brand-50 text-center text-sm font-bold text-brand-700 outline-none focus:ring-2 focus:ring-brand-300 disabled:cursor-default"
                  >
                    {evento.dinamicas.map((_, pos) => (
                      <option key={pos} value={pos}>
                        {pos + 1}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    title="Descer"
                    disabled={i === evento.dinamicas.length - 1 || movendo}
                    onClick={() => reordenar(i, i + 1)}
                    className="rounded p-0.5 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-navy">{d.nome}</p>
                    {d.peso !== 1 && (
                      <Badge variant="secondary">×{nf(d.peso)}</Badge>
                    )}
                    {d.tipo === "quiz" && (
                      <Badge className="gap-1 bg-brand-100 text-brand-700 hover:bg-brand-100">
                        <ListChecks className="h-3 w-3" /> Quiz
                      </Badge>
                    )}
                    {d.tipo === "quiz" && d.quizAberto && (
                      <Badge className="gap-1 bg-green-100 text-green-700 hover:bg-green-100">
                        <Radio className="h-3 w-3" /> Aberto
                      </Badge>
                    )}
                    {d.tipo === "tesouro" && (
                      <Badge className="gap-1 bg-amber-100 text-amber-700 hover:bg-amber-100">
                        <KeyRound className="h-3 w-3" /> Caça ao Tesouro
                      </Badge>
                    )}
                    {d.tipo === "grito" && (
                      <Badge className="gap-1 bg-purple-100 text-purple-700 hover:bg-purple-100">
                        <Megaphone className="h-3 w-3" /> Grito de Guerra
                      </Badge>
                    )}
                    {d.tipo === "grito" && d.quizAberto && (
                      <Badge className="gap-1 bg-green-100 text-green-700 hover:bg-green-100">
                        <Radio className="h-3 w-3" /> Aberto
                      </Badge>
                    )}
                  </div>
                  {d.descricao && (
                    <p className="truncate text-sm text-slate-500">
                      {d.descricao}
                    </p>
                  )}
                  {d.tipo === "quiz" && (
                    <p className="mt-0.5 text-xs text-slate-400">
                      {d.perguntas.length} pergunta
                      {d.perguntas.length === 1 ? "" : "s"} ·{" "}
                      {d.submissoes.length} resposta
                      {d.submissoes.length === 1 ? "" : "s"}
                    </p>
                  )}
                  {d.tipo === "tesouro" && (
                    <p className="mt-0.5 text-xs text-slate-400">
                      {d.cartoesTesouro.length} bloco
                      {d.cartoesTesouro.length === 1 ? "" : "s"} ·{" "}
                      {d.tesouroVencedor ? (
                        <span className="font-medium text-green-600">
                          aberto por {d.tesouroVencedor.nome}
                        </span>
                      ) : (
                        <span>por abrir · {nf(d.valorTesouro)} pt ao vencedor</span>
                      )}
                    </p>
                  )}
                  {d.tipo === "grito" && (
                    <p className="mt-0.5 text-xs text-slate-400">
                      {d.votos.length} voto{d.votos.length === 1 ? "" : "s"} ·{" "}
                      {nf(d.valorPorVoto)} pt/voto ao vencedor
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {/* QR/controlo sempre visível para quizzes e gritos */}
                  {(d.tipo === "quiz" || d.tipo === "grito") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 border-brand-200 text-brand-700 hover:bg-brand-50"
                      onClick={() => setControlo(d)}
                    >
                      <QrCode className="h-4 w-4" /> QR
                    </Button>
                  )}
                  {/* Baú: ecrã de projeção do desbloqueio (caça ao tesouro) */}
                  {d.tipo === "tesouro" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1.5 border-amber-200 text-amber-700 hover:bg-amber-50"
                      onClick={() => setBau(d)}
                    >
                      <Lock className="h-4 w-4" /> Baú
                    </Button>
                  )}
                  <div className="flex gap-1 md:opacity-0 md:transition md:group-hover:opacity-100">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => setModal(d)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setRemover(d)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <DinamicaForm
          eventoId={evento.id}
          equipas={evento.equipas}
          dinamica={"id" in modal ? (modal as Dinamica) : null}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            onChange();
          }}
        />
      )}
      {remover && (
        <ConfirmDialog
          title="Eliminar dinâmica"
          message={`Eliminar "${remover.nome}"? As pontuações lançadas nesta dinâmica serão apagadas.`}
          confirmLabel="Eliminar"
          danger
          busy={busy}
          onConfirm={excluir}
          onCancel={() => setRemover(null)}
        />
      )}
      {controlo && controlo.tipo === "grito" && (
        <GritoControloModal
          dinamica={controlo}
          onClose={() => setControlo(null)}
          onChange={onChange}
        />
      )}
      {controlo && controlo.tipo !== "grito" && (
        <QuizControloModal
          dinamica={controlo}
          onClose={() => setControlo(null)}
          onChange={onChange}
        />
      )}
      {bau && (
        <BauProjecao
          dinamica={bau}
          onClose={() => setBau(null)}
          onChange={onChange}
        />
      )}
    </div>
  );
}

/* ===================== Controlo do quiz (QR + abrir) ==================== */

function QuizControloModal({
  dinamica,
  onClose,
  onChange,
}: {
  dinamica: Dinamica;
  onClose: () => void;
  onChange: () => void;
}) {
  const [aberto, setAberto] = useState(dinamica.quizAberto);
  const [qr, setQr] = useState<string>("");
  const [projetar, setProjetar] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [submissoes, setSubmissoes] = useState<
    { id: string; nomeMembro: string; certas: number; totalPerguntas: number; pontos: number; equipa: { nome: string; cor: string } }[]
  >([]);
  const [busy, setBusy] = useState(false);
  const [vista, setVista] = useState<"pessoa" | "equipa">("pessoa");
  const [aEliminar, setAEliminar] = useState<string | null>(null);
  const [confirmarLimpar, setConfirmarLimpar] = useState(false);

  const numPerguntas = dinamica.perguntas.length;

  // Ranking por equipa = soma dos pontos dos membros ÷ nº de perguntas do quiz.
  const rankingEquipas = useMemo(() => {
    const mapa = new Map<
      string,
      { nome: string; cor: string; soma: number; membros: number }
    >();
    for (const s of submissoes) {
      const chave = s.equipa.nome;
      const atual =
        mapa.get(chave) ?? { nome: s.equipa.nome, cor: s.equipa.cor, soma: 0, membros: 0 };
      atual.soma += s.pontos;
      atual.membros += 1;
      mapa.set(chave, atual);
    }
    return [...mapa.values()]
      .map((e) => ({ ...e, media: numPerguntas > 0 ? e.soma / numPerguntas : 0 }))
      .sort((a, b) => b.media - a.media);
  }, [submissoes, numPerguntas]);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/q/${dinamica.id}`
      : `/q/${dinamica.id}`;

  useEffect(() => {
    // Alta resolução para projeção (mostrado reduzido no modal).
    QRCode.toDataURL(url, { width: 1024, margin: 1 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [url]);

  const carregarSubs = useCallback(async () => {
    try {
      const d = await api<{ submissoes: typeof submissoes }>(
        `/api/gamificacao/dinamicas/${dinamica.id}/submissoes`
      );
      setSubmissoes(d.submissoes);
    } catch {
      /* ignora falhas de polling */
    }
  }, [dinamica.id]);

  useEffect(() => {
    carregarSubs();
    const t = setInterval(carregarSubs, 4000);
    return () => clearInterval(t);
  }, [carregarSubs]);

  async function toggleAberto() {
    const novo = !aberto;
    setBusy(true);
    try {
      await api(`/api/gamificacao/dinamicas/${dinamica.id}`, {
        method: "PUT",
        body: JSON.stringify({ quizAberto: novo }),
      });
      setAberto(novo);
      toast.success(novo ? "Quiz aberto a respostas" : "Quiz fechado");
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function copiar() {
    navigator.clipboard?.writeText(url).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    });
  }

  async function eliminarSubmissao(submissaoId: string) {
    setAEliminar(submissaoId);
    try {
      await api(`/api/gamificacao/dinamicas/${dinamica.id}/submissoes`, {
        method: "DELETE",
        body: JSON.stringify({ submissaoId }),
      });
      await carregarSubs();
      onChange();
      toast.success("Resposta eliminada");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAEliminar(null);
    }
  }

  async function eliminarTodas() {
    setBusy(true);
    try {
      await api(`/api/gamificacao/dinamicas/${dinamica.id}/submissoes`, {
        method: "DELETE",
        body: JSON.stringify({}),
      });
      await carregarSubs();
      onChange();
      toast.success("Todas as respostas foram eliminadas");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      setConfirmarLimpar(false);
    }
  }

  return (
    <Modal
      title={`Quiz — ${dinamica.nome}`}
      onClose={onClose}
      footer={
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div className="space-y-4">
        {dinamica.perguntas.length === 0 && (
          <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
            Este quiz ainda não tem perguntas. Edita a dinâmica para as
            adicionar.
          </div>
        )}

        <div className="flex flex-col items-center gap-2">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt="QR Code do quiz"
              className="h-56 w-56 rounded-xl border border-slate-200"
            />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center rounded-xl border border-slate-200 text-slate-300">
              <QrCode className="h-10 w-10" />
            </div>
          )}
          <p className="text-center text-xs text-slate-500">
            Projeta ou imprime este QR Code. Cada membro lê, escolhe a equipa e
            o seu nome, e responde.
          </p>
          <Button
            variant="navy"
            size="sm"
            className="w-full"
            onClick={() => setProjetar(true)}
            disabled={!qr}
          >
            <Maximize className="h-4 w-4" /> Projetar em ecrã cheio
          </Button>
          <div className="flex w-full items-center gap-2">
            <input
              readOnly
              value={url}
              className="h-9 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs text-slate-600 outline-none"
            />
            <Button size="sm" variant="outline" onClick={copiar}>
              {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {projetar && (
          <QrProjecao
            url={url}
            qr={qr}
            titulo={dinamica.nome}
            onClose={() => setProjetar(false)}
          />
        )}

        <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
          <div>
            <p className="text-sm font-semibold text-navy">
              {aberto ? "Aberto a respostas" : "Fechado"}
            </p>
            <p className="text-xs text-slate-400">
              {aberto
                ? "Os membros já podem responder."
                : "Abre quando quiseres começar."}
              {dinamica.tempoLimiteSeg
                ? ` ${dinamica.tempoLimiteSeg}s por pergunta (avança sozinho).`
                : ""}
            </p>
          </div>
          <Button
            variant={aberto ? "outline" : "navy"}
            size="sm"
            disabled={busy || dinamica.perguntas.length === 0}
            onClick={toggleAberto}
          >
            <Radio className="h-4 w-4" /> {aberto ? "Fechar" : "Abrir quiz"}
          </Button>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">
              Respostas ({submissoes.length})
            </p>
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
              </span>
              ao vivo
            </span>
          </div>

          {/* Alternar entre ranking por pessoa e por equipa. */}
          <div className="mb-2 inline-flex rounded-lg bg-slate-100 p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setVista("pessoa")}
              className={`rounded-md px-3 py-1 transition ${
                vista === "pessoa"
                  ? "bg-white text-navy shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Por pessoa
            </button>
            <button
              type="button"
              onClick={() => setVista("equipa")}
              className={`rounded-md px-3 py-1 transition ${
                vista === "equipa"
                  ? "bg-white text-navy shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Por equipa
            </button>
          </div>

          {submissoes.length === 0 ? (
            <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-400">
              Ainda sem respostas.
            </p>
          ) : vista === "pessoa" ? (
            <div className="max-h-52 space-y-1.5 overflow-y-auto">
              {submissoes.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: s.equipa.cor }}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-700">
                    {s.nomeMembro}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {s.equipa.nome}
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {s.certas}/{s.totalPerguntas}
                  </span>
                  <span className="w-12 shrink-0 text-right font-bold text-navy">
                    {nf(s.pontos)}
                  </span>
                  <button
                    type="button"
                    title="Eliminar esta resposta"
                    disabled={aEliminar === s.id}
                    onClick={() => eliminarSubmissao(s.id)}
                    className="shrink-0 rounded-md p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="max-h-52 space-y-1.5 overflow-y-auto">
              {rankingEquipas.map((e, i) => (
                <div
                  key={e.nome}
                  className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="w-5 shrink-0 text-center text-xs font-bold text-slate-400">
                    {i + 1}
                  </span>
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: e.cor }}
                  />
                  <span className="min-w-0 flex-1 truncate font-medium text-slate-700">
                    {e.nome}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {e.membros} {e.membros === 1 ? "membro" : "membros"}
                  </span>
                  <span className="w-12 shrink-0 text-right font-bold text-navy">
                    {nf(e.media)}
                  </span>
                </div>
              ))}
              <p className="px-1 pt-1 text-[11px] text-slate-400">
                Média = soma dos pontos dos membros ÷ {numPerguntas}{" "}
                {numPerguntas === 1 ? "pergunta" : "perguntas"}.
              </p>
            </div>
          )}

          {submissoes.length > 0 && (
            <div className="mt-2 flex justify-end">
              <Button
                variant="outline"
                size="sm"
                disabled={busy}
                onClick={() => setConfirmarLimpar(true)}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" /> Eliminar todas as respostas
              </Button>
            </div>
          )}
        </div>
      </div>

      {confirmarLimpar && (
        <ConfirmDialog
          title="Eliminar todas as respostas?"
          message={`Vais apagar as ${submissoes.length} respostas deste quiz e limpar a pontuação da dinâmica. Esta acção não pode ser anulada.`}
          confirmLabel="Eliminar todas"
          danger
          busy={busy}
          onConfirm={eliminarTodas}
          onCancel={() => setConfirmarLimpar(false)}
        />
      )}
    </Modal>
  );
}

/* ================= Controlo do Grito de Guerra (votação) ================ */

type VotoAdmin = {
  id: string;
  votanteEquipa: { id: string; nome: string; cor: string };
  votadaEquipa: { id: string; nome: string; cor: string };
};
type ApuramentoGrito = {
  contagem: { equipaId: string; votos: number }[];
  vencedorEquipaId: string | null;
  maxVotos: number;
  empate: boolean;
};

function GritoControloModal({
  dinamica,
  onClose,
  onChange,
}: {
  dinamica: Dinamica;
  onClose: () => void;
  onChange: () => void;
}) {
  const [aberto, setAberto] = useState(dinamica.quizAberto);
  const [qr, setQr] = useState<string>("");
  const [projetar, setProjetar] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [votos, setVotos] = useState<VotoAdmin[]>([]);
  const [apuramento, setApuramento] = useState<ApuramentoGrito>({
    contagem: [],
    vencedorEquipaId: null,
    maxVotos: 0,
    empate: false,
  });
  const [busy, setBusy] = useState(false);
  const [aEliminar, setAEliminar] = useState<string | null>(null);
  const [confirmarLimpar, setConfirmarLimpar] = useState(false);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/v/${dinamica.id}`
      : `/v/${dinamica.id}`;

  useEffect(() => {
    QRCode.toDataURL(url, { width: 1024, margin: 1 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [url]);

  const carregarVotos = useCallback(async () => {
    try {
      const d = await api<{ votos: VotoAdmin[]; apuramento: ApuramentoGrito }>(
        `/api/gamificacao/dinamicas/${dinamica.id}/votos`
      );
      setVotos(d.votos);
      setApuramento(d.apuramento);
    } catch {
      /* ignora falhas de polling */
    }
  }, [dinamica.id]);

  useEffect(() => {
    carregarVotos();
    const t = setInterval(carregarVotos, 4000);
    return () => clearInterval(t);
  }, [carregarVotos]);

  // Nome/cor por equipa (resolvido a partir dos votos observados).
  const infoEquipa = useMemo(() => {
    const m = new Map<string, { nome: string; cor: string }>();
    for (const v of votos) {
      m.set(v.votadaEquipa.id, {
        nome: v.votadaEquipa.nome,
        cor: v.votadaEquipa.cor,
      });
      m.set(v.votanteEquipa.id, {
        nome: v.votanteEquipa.nome,
        cor: v.votanteEquipa.cor,
      });
    }
    return m;
  }, [votos]);

  const tabela = useMemo(
    () =>
      apuramento.contagem
        .map((c) => ({
          ...c,
          nome: infoEquipa.get(c.equipaId)?.nome ?? "—",
          cor: infoEquipa.get(c.equipaId)?.cor ?? "#94a3b8",
        }))
        .sort((a, b) => b.votos - a.votos || a.nome.localeCompare(b.nome)),
    [apuramento.contagem, infoEquipa]
  );

  async function toggleAberto() {
    const novo = !aberto;
    setBusy(true);
    try {
      await api(`/api/gamificacao/dinamicas/${dinamica.id}`, {
        method: "PUT",
        body: JSON.stringify({ quizAberto: novo }),
      });
      setAberto(novo);
      toast.success(novo ? "Votação aberta" : "Votação fechada");
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function copiar() {
    navigator.clipboard?.writeText(url).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    });
  }

  async function eliminarVoto(votoId: string) {
    setAEliminar(votoId);
    try {
      await api(`/api/gamificacao/dinamicas/${dinamica.id}/votos`, {
        method: "DELETE",
        body: JSON.stringify({ votoId }),
      });
      await carregarVotos();
      onChange();
      toast.success("Voto eliminado");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setAEliminar(null);
    }
  }

  async function eliminarTodos() {
    setBusy(true);
    try {
      await api(`/api/gamificacao/dinamicas/${dinamica.id}/votos`, {
        method: "DELETE",
        body: JSON.stringify({}),
      });
      await carregarVotos();
      onChange();
      toast.success("Todos os votos foram eliminados");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      setConfirmarLimpar(false);
    }
  }

  const vencedorNome = apuramento.vencedorEquipaId
    ? infoEquipa.get(apuramento.vencedorEquipaId)?.nome ?? "—"
    : null;

  return (
    <Modal
      title={`Grito de Guerra — ${dinamica.nome}`}
      onClose={onClose}
      footer={
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-col items-center gap-2">
          {qr ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qr}
              alt="QR Code da votação"
              className="h-56 w-56 rounded-xl border border-slate-200"
            />
          ) : (
            <div className="flex h-56 w-56 items-center justify-center rounded-xl border border-slate-200 text-slate-300">
              <QrCode className="h-10 w-10" />
            </div>
          )}
          <p className="text-center text-xs text-slate-500">
            Projeta ou imprime este QR Code. Cada grupo lê, escolhe o seu grupo e
            vota no melhor grito de guerra de outro grupo.
          </p>
          <Button
            variant="navy"
            size="sm"
            className="w-full"
            onClick={() => setProjetar(true)}
            disabled={!qr}
          >
            <Maximize className="h-4 w-4" /> Projetar em ecrã cheio
          </Button>
          <div className="flex w-full items-center gap-2">
            <input
              readOnly
              value={url}
              className="h-9 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs text-slate-600 outline-none"
            />
            <Button size="sm" variant="outline" onClick={copiar}>
              {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {projetar && (
          <QrProjecao
            url={url}
            qr={qr}
            titulo={dinamica.nome}
            onClose={() => setProjetar(false)}
          />
        )}

        <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
          <div>
            <p className="text-sm font-semibold text-navy">
              {aberto ? "Aberta a votos" : "Fechada"}
            </p>
            <p className="text-xs text-slate-400">
              {aberto
                ? "Os grupos já podem votar."
                : "Abre quando quiseres começar a votação."}{" "}
              {nf(dinamica.valorPorVoto)} pt por voto ao vencedor.
            </p>
          </div>
          <Button
            variant={aberto ? "outline" : "navy"}
            size="sm"
            disabled={busy}
            onClick={toggleAberto}
          >
            <Radio className="h-4 w-4" /> {aberto ? "Fechar" : "Abrir votação"}
          </Button>
        </div>

        {/* Apuramento */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">
              Votos ({votos.length})
            </p>
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
              </span>
              ao vivo
            </span>
          </div>

          {/* Estado do vencedor */}
          {votos.length > 0 && (
            <div
              className={`mb-2 rounded-lg px-3 py-2 text-sm font-medium ${
                vencedorNome
                  ? "bg-green-50 text-green-700"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {vencedorNome ? (
                <>
                  <Trophy className="mr-1 inline h-4 w-4" /> Vencedor:{" "}
                  <strong>{vencedorNome}</strong> — {apuramento.maxVotos} voto
                  {apuramento.maxVotos === 1 ? "" : "s"} ·{" "}
                  {nf(apuramento.maxVotos * dinamica.valorPorVoto)} pontos
                </>
              ) : (
                <>Empate no topo ({apuramento.maxVotos}) — sem vencedor por agora.</>
              )}
            </div>
          )}

          {votos.length === 0 ? (
            <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-400">
              Ainda sem votos.
            </p>
          ) : (
            <>
              {/* Barras por equipa */}
              <div className="mb-3 space-y-1.5">
                {tabela.map((t) => {
                  const pct =
                    apuramento.maxVotos > 0
                      ? (t.votos / apuramento.maxVotos) * 100
                      : 0;
                  const venc = t.equipaId === apuramento.vencedorEquipaId;
                  return (
                    <div key={t.equipaId} className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: t.cor }}
                      />
                      <span className="w-24 shrink-0 truncate text-xs font-medium text-slate-700">
                        {t.nome}
                        {venc && (
                          <Crown className="ml-1 inline h-3 w-3 text-amber-500" />
                        )}
                      </span>
                      <span className="relative h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <span
                          className="absolute inset-y-0 left-0 rounded-full"
                          style={{ width: `${pct}%`, background: t.cor }}
                        />
                      </span>
                      <span className="w-6 shrink-0 text-right text-xs font-bold text-navy">
                        {t.votos}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Lista de votos individuais */}
              <div className="max-h-40 space-y-1.5 overflow-y-auto">
                {votos.map((v) => (
                  <div
                    key={v.id}
                    className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate text-slate-500">
                      <span className="font-medium text-slate-700">
                        {v.votanteEquipa.nome}
                      </span>{" "}
                      votou em{" "}
                      <span className="font-medium text-slate-700">
                        {v.votadaEquipa.nome}
                      </span>
                    </span>
                    <button
                      type="button"
                      title="Eliminar este voto"
                      disabled={aEliminar === v.id}
                      onClick={() => eliminarVoto(v.id)}
                      className="shrink-0 rounded-md p-1 text-slate-300 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>

              <div className="mt-2 flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => setConfirmarLimpar(true)}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" /> Eliminar todos os votos
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {confirmarLimpar && (
        <ConfirmDialog
          title="Eliminar todos os votos?"
          message={`Vais apagar os ${votos.length} votos desta dinâmica e limpar a pontuação. Esta acção não pode ser anulada.`}
          confirmLabel="Eliminar todos"
          danger
          busy={busy}
          onConfirm={eliminarTodos}
          onCancel={() => setConfirmarLimpar(false)}
        />
      )}
    </Modal>
  );
}

/* ============ Baú da Caça ao Tesouro (projeção do desbloqueio) ========= */

type EquipaMini = { id: string; nome: string; cor: string };
type TentativaAdmin = {
  id: string;
  combinacao: string;
  correta: boolean;
  createdAt: string;
  equipa: EquipaMini;
};

function BauProjecao({
  dinamica,
  onClose,
  onChange,
}: {
  dinamica: Dinamica;
  onClose: () => void;
  onChange: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fs, setFs] = useState(false);
  const [qr, setQr] = useState("");
  const [tentativas, setTentativas] = useState<TentativaAdmin[]>([]);
  const [vencedor, setVencedor] = useState<EquipaMini | null>(
    dinamica.tesouroVencedor ?? null
  );
  const [repondo, setRepondo] = useState(false);
  const [confirmarRepor, setConfirmarRepor] = useState(false);

  // O baú abre em função do estado do SERVIDOR (a 1ª equipa a acertar).
  const aberto = !!vencedor;

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/t/${dinamica.id}`
      : `/t/${dinamica.id}`;

  useEffect(() => {
    QRCode.toDataURL(url, { width: 1024, margin: 1 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [url]);

  const carregar = useCallback(async () => {
    try {
      const d = await api<{
        vencedor: EquipaMini | null;
        tentativas: TentativaAdmin[];
      }>(`/api/gamificacao/dinamicas/${dinamica.id}/tesouro`);
      setTentativas(d.tentativas);
      setVencedor(d.vencedor);
    } catch {
      /* ignora falhas de polling */
    }
  }, [dinamica.id]);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, 3000);
    return () => clearInterval(t);
  }, [carregar]);

  async function repor() {
    setRepondo(true);
    try {
      await api(`/api/gamificacao/dinamicas/${dinamica.id}/tesouro`, {
        method: "DELETE",
      });
      setVencedor(null);
      setTentativas([]);
      await carregar();
      onChange();
      toast.success("Baú reposto");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setRepondo(false);
      setConfirmarRepor(false);
    }
  }

  // Som de desbloqueio (sintetizado — sem ficheiros): clunk do cadeado +
  // arpejo dourado + brilho. Toca sempre que o baú passa a aberto.
  useEffect(() => {
    if (!aberto) return;
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!AC) return;
      const ctx = new AC();
      const now = ctx.currentTime;
      const nota = (
        freq: number,
        t0: number,
        dur: number,
        vol: number,
        tipo: OscillatorType
      ) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = tipo;
        o.frequency.value = freq;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(vol, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0006, t0 + dur);
        o.connect(g).connect(ctx.destination);
        o.start(t0);
        o.stop(t0 + dur + 0.05);
      };
      // Clunk grave do cadeado a partir.
      const clunk = ctx.createOscillator();
      const cg = ctx.createGain();
      clunk.type = "sine";
      clunk.frequency.setValueAtTime(150, now);
      clunk.frequency.exponentialRampToValueAtTime(55, now + 0.18);
      cg.gain.setValueAtTime(0.0001, now);
      cg.gain.exponentialRampToValueAtTime(0.5, now + 0.01);
      cg.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      clunk.connect(cg).connect(ctx.destination);
      clunk.start(now);
      clunk.stop(now + 0.26);
      // Arpejo dourado (Dó maior a subir).
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        nota(f, now + 0.12 + i * 0.09, 0.6, 0.32, "triangle")
      );
      // Brilho cintilante.
      for (let i = 0; i < 5; i++)
        nota(1500 + i * 420, now + 0.42 + i * 0.05, 0.28, 0.11, "sine");
      const t = setTimeout(() => ctx.close().catch(() => {}), 1600);
      return () => clearTimeout(t);
    } catch {
      /* áudio bloqueado/indisponível — ignora */
    }
  }, [aberto]);

  // Partículas de brilho fixas (posições/atrasos deterministas por índice).
  const faiscas = useMemo(
    () =>
      Array.from({ length: 22 }, (_, i) => ({
        left: 6 + ((i * 37) % 88),
        delay: (i % 11) * 0.18,
        dur: 1.6 + ((i * 7) % 12) / 10,
        size: 4 + (i % 4) * 2,
      })),
    []
  );
  const poeira = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        left: (i * 61) % 100,
        top: (i * 43) % 100,
        delay: (i % 8) * 0.5,
        dur: 5 + (i % 5),
        size: 2 + (i % 3),
      })),
    []
  );
  // Fragmentos do cadeado a estilhaçar (voam para fora e caem).
  const estilhacos = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        tx: (i - 3.5) * 24,
        r: (i % 2 ? 1 : -1) * (200 + i * 55),
        delay: (i % 3) * 0.02,
        dur: 0.75 + (i % 3) * 0.12,
      })),
    []
  );
  // Moedas a saltar do baú em arco (com giro).
  const moedas = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        cx: (i - 6.5) * 19,
        peak: -(120 + (i % 5) * 42),
        rot: (i % 2 ? 1 : -1) * (720 + (i % 3) * 360),
        delay: 0.1 + (i % 7) * 0.06,
        dur: 1.05 + (i % 5) * 0.14,
      })),
    []
  );

  useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function toggleFs() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await ref.current?.requestFullscreen();
    } catch {
      /* alguns browsers bloqueiam sem gesto — ignora */
    }
  }

  return (
    <div
      ref={ref}
      className={`bau-cena fixed inset-0 z-[70] flex flex-col items-center justify-center overflow-hidden px-6 py-8 ${
        aberto ? "is-open" : ""
      }`}
    >
      {/* Fundo: brilho + poeira dourada */}
      <div className="bau-fundo" />
      <div className="bau-raios" aria-hidden />
      <div className="pointer-events-none absolute inset-0">
        {poeira.map((p, i) => (
          <span
            key={i}
            className="bau-poeira"
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              width: p.size,
              height: p.size,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.dur}s`,
            }}
          />
        ))}
      </div>

      {/* Controlos */}
      <div className="absolute right-4 top-4 z-20 flex gap-2">
        <button
          onClick={toggleFs}
          title="Ecrã cheio"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-amber-100 backdrop-blur transition hover:bg-white/20"
        >
          <Maximize className="h-5 w-5" />
        </button>
        <button
          onClick={() => {
            if (document.fullscreenElement)
              document.exitFullscreen().catch(() => {});
            onClose();
          }}
          title="Fechar"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-amber-100 backdrop-blur transition hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Cabeçalho */}
      <div className="z-10 mb-6 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-amber-400/80">
          Caça ao Tesouro
        </p>
        <h1 className="bau-titulo mt-1 text-4xl font-black sm:text-6xl">
          {dinamica.nome}
        </h1>
      </div>

      {/* Cena do baú */}
      <div className="bau-palco z-10">
        {/* Faíscas do tesouro (só quando aberto) */}
        {aberto && (
          <div className="pointer-events-none absolute inset-0">
            {faiscas.map((f, i) => (
              <span
                key={i}
                className="bau-faisca"
                style={{
                  left: `${f.left}%`,
                  width: f.size,
                  height: f.size,
                  animationDelay: `${f.delay}s`,
                  animationDuration: `${f.dur}s`,
                }}
              />
            ))}
          </div>
        )}

        <div className="bau">
          {/* Interior luminoso (visível quando abre) */}
          <div className="bau-interior">
            <Sparkles className="bau-brilho-icone" />
          </div>
          {/* Corpo do baú */}
          <div className="bau-corpo">
            <span className="bau-banda" style={{ left: "18%" }} />
            <span className="bau-banda" style={{ left: "50%" }} />
            <span className="bau-banda" style={{ left: "82%" }} />
            <span className="bau-fechadura" />
          </div>
          {/* Tampa */}
          <div
            className="bau-tampa"
            style={{ transform: aberto ? "rotateX(-118deg)" : "rotateX(0deg)" }}
          >
            <span className="bau-banda-tampa" style={{ left: "18%" }} />
            <span className="bau-banda-tampa" style={{ left: "50%" }} />
            <span className="bau-banda-tampa" style={{ left: "82%" }} />
          </div>
          {/* Cadeado intacto (só fechado) */}
          {!aberto && (
            <div className="bau-cadeado">
              <Lock className="h-6 w-6" />
            </div>
          )}
          {/* Cadeado a estilhaçar */}
          {aberto && (
            <div className="bau-estilhacos">
              {estilhacos.map((e, i) => (
                <span
                  key={i}
                  className="bau-estilhaco"
                  style={
                    {
                      "--tx": `${e.tx}px`,
                      "--r": `${e.r}`,
                      animationDelay: `${e.delay}s`,
                      animationDuration: `${e.dur}s`,
                    } as unknown as CSSProperties
                  }
                />
              ))}
            </div>
          )}
          {/* Moedas a saltar */}
          {aberto && (
            <div className="bau-moedas">
              {moedas.map((m, i) => (
                <span
                  key={i}
                  className="bau-moeda"
                  style={
                    {
                      "--cx": `${m.cx}px`,
                      "--peak": `${m.peak}px`,
                      "--rot": `${m.rot}deg`,
                      animationDelay: `${m.delay}s`,
                      animationDuration: `${m.dur}s`,
                    } as unknown as CSSProperties
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Painel: QR + feed de tentativas (ou vencedor) */}
      <div className="z-10 mt-6 w-full max-w-3xl px-2">
        {aberto && vencedor ? (
          <div className="bau-vitoria mb-5 text-center">
            <p className="flex items-center justify-center gap-2 text-sm font-bold uppercase tracking-[0.3em] text-amber-300/80">
              <Trophy className="h-5 w-5" /> Vencedor
            </p>
            <h2 className="bau-vencedor mt-1" style={{ color: vencedor.cor }}>
              {vencedor.nome}
            </h2>
            <p className="mt-2 text-amber-100/70">
              Abriram o baú — +{nf(dinamica.valorTesouro)} pontos!
            </p>
          </div>
        ) : (
          <div className="mb-5 flex flex-col items-center gap-2">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr}
                alt="QR Code do baú"
                className="h-40 w-40 rounded-xl border border-amber-200/20 bg-white p-1.5"
              />
            ) : (
              <div className="flex h-40 w-40 items-center justify-center rounded-xl border border-amber-200/20 text-amber-200/40">
                <QrCode className="h-10 w-10" />
              </div>
            )}
            <p className="max-w-sm text-center text-sm text-amber-100/70">
              Lê o QR Code, escolhe o teu grupo e insere a combinação que
              descobriram para tentar abrir o baú.
            </p>
          </div>
        )}

        {/* Feed de tentativas ao vivo */}
        <div className="mx-auto max-w-xl">
          <p className="mb-2 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-200/70">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
            </span>
            Tentativas ({tentativas.length})
          </p>
          {tentativas.length === 0 ? (
            <p className="rounded-lg bg-white/5 px-3 py-3 text-center text-sm text-amber-100/40">
              Ainda sem tentativas. Aguardem as equipas…
            </p>
          ) : (
            <div className="max-h-44 space-y-1.5 overflow-y-auto">
              {tentativas.map((t) => (
                <div
                  key={t.id}
                  className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${
                    t.correta ? "bg-green-400/15" : "bg-white/5"
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: t.equipa.cor }}
                  />
                  <span className="shrink-0 font-semibold text-amber-50">
                    {t.equipa.nome}
                  </span>
                  <span className="truncate font-mono tracking-widest text-amber-100/60">
                    {t.combinacao}
                  </span>
                  <span className="ml-auto shrink-0">
                    {t.correta ? (
                      <Check className="h-4 w-4 text-green-400" />
                    ) : (
                      <X className="h-4 w-4 text-red-400/70" />
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Controlos inferiores */}
      <div className="z-10 mt-6 flex flex-wrap items-center justify-center gap-2">
        {!fs && (
          <button
            onClick={toggleFs}
            className="inline-flex items-center gap-2 rounded-full bg-amber-500/90 px-5 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-400"
          >
            <Maximize className="h-4 w-4" /> Entrar em ecrã cheio
          </button>
        )}
        {aberto && (
          <button
            onClick={() => setConfirmarRepor(true)}
            disabled={repondo}
            className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-amber-100 backdrop-blur transition hover:bg-white/20 disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" /> Repor baú
          </button>
        )}
      </div>

      {confirmarRepor && (
        <ConfirmDialog
          title="Repor o baú?"
          message="Vais apagar o vencedor, as tentativas e a pontuação atribuída, para jogar outra ronda. Esta acção não pode ser anulada."
          confirmLabel="Repor"
          danger
          busy={repondo}
          onConfirm={repor}
          onCancel={() => setConfirmarRepor(false)}
        />
      )}

      <style>{`
        .bau-cena {
          background:
            radial-gradient(120% 80% at 50% 15%, #1e1608 0%, #0a0a12 55%, #050509 100%);
        }
        .bau-fundo {
          position: absolute; inset: 0;
          background: radial-gradient(50% 45% at 50% 55%, rgba(245,158,11,.18), transparent 70%);
          opacity: .5; transition: opacity .8s ease;
        }
        .bau-cena.is-open .bau-fundo { opacity: 1; }
        .bau-raios {
          position: absolute; left: 50%; top: 54%;
          width: 160vmax; height: 160vmax; transform: translate(-50%, -50%);
          background: repeating-conic-gradient(from 0deg,
            rgba(253,224,71,.16) 0deg, rgba(253,224,71,0) 7deg 18deg);
          -webkit-mask: radial-gradient(closest-side, #000 0%, transparent 62%);
          mask: radial-gradient(closest-side, #000 0%, transparent 62%);
          opacity: 0; animation: bau-spin 26s linear infinite;
          transition: opacity 1s ease;
        }
        .bau-cena.is-open .bau-raios { opacity: .9; }
        @keyframes bau-spin { to { transform: translate(-50%, -50%) rotate(360deg); } }

        .bau-poeira {
          position: absolute; border-radius: 9999px;
          background: rgba(253,224,71,.5);
          box-shadow: 0 0 6px rgba(253,224,71,.6);
          animation: bau-flutua linear infinite; opacity: .5;
        }
        @keyframes bau-flutua {
          0% { transform: translateY(8px); opacity: 0; }
          30% { opacity: .6; }
          100% { transform: translateY(-26px); opacity: 0; }
        }

        .bau-titulo {
          background: linear-gradient(180deg, #fff7e0, #fbbf24 55%, #d97706);
          -webkit-background-clip: text; background-clip: text; color: transparent;
          text-shadow: 0 2px 30px rgba(245,158,11,.25);
        }

        .bau-palco {
          position: relative; width: 360px; max-width: 88vw;
          display: flex; align-items: flex-end; justify-content: center;
        }
        .bau {
          position: relative; width: 300px; height: 236px; max-width: 82vw;
          perspective: 1100px;
          filter: drop-shadow(0 26px 30px rgba(0,0,0,.55));
        }
        .bau-cena.is-open .bau { animation: bau-salta .7s cubic-bezier(.22,1.4,.4,1); }
        @keyframes bau-salta {
          0% { transform: translateY(0) scale(1); }
          40% { transform: translateY(-14px) scale(1.04); }
          100% { transform: translateY(0) scale(1); }
        }

        .bau-corpo {
          position: absolute; bottom: 0; left: 0; width: 300px; height: 138px;
          border-radius: 10px 10px 14px 14px;
          background:
            linear-gradient(180deg, #7c3f12 0%, #5a2c0c 60%, #3f1e08 100%);
          border: 3px solid #2c1606;
          box-shadow: inset 0 8px 16px rgba(0,0,0,.35), inset 0 -6px 12px rgba(0,0,0,.4);
          overflow: hidden;
        }
        .bau-interior {
          position: absolute; bottom: 118px; left: 12px; width: 276px; height: 70px;
          border-radius: 8px 8px 40px 40px;
          background: radial-gradient(60% 100% at 50% 100%, #fff4c2, #fbbf24 45%, #b45309 90%);
          opacity: 0; transform: scaleY(.2); transform-origin: bottom;
          transition: opacity .5s ease .25s, transform .5s ease .25s;
          box-shadow: 0 0 45px 12px rgba(251,191,36,.75);
          display: flex; align-items: center; justify-content: center;
        }
        .bau-cena.is-open .bau-interior { opacity: 1; transform: scaleY(1); }
        .bau-brilho-icone {
          width: 34px; height: 34px; color: #fffdf0;
          filter: drop-shadow(0 0 8px #fff6cf);
          animation: bau-pisca 1.6s ease-in-out infinite;
        }
        @keyframes bau-pisca { 0%,100% { opacity:.7; transform: scale(.9);} 50% { opacity:1; transform: scale(1.1);} }

        .bau-banda {
          position: absolute; top: 0; bottom: 0; width: 12px; margin-left: -6px;
          background: linear-gradient(90deg, #b45309, #fbbf24 45%, #92400e);
          box-shadow: inset 0 0 4px rgba(0,0,0,.4);
        }
        .bau-fechadura {
          position: absolute; top: 8px; left: 50%; width: 30px; height: 34px;
          margin-left: -15px; border-radius: 4px;
          background: linear-gradient(180deg, #fcd34d, #b45309);
          border: 2px solid #7c2d12;
          box-shadow: 0 0 10px rgba(251,191,36,.5);
        }

        .bau-tampa {
          position: absolute; top: 16px; left: 0; width: 300px; height: 96px;
          transform-origin: center bottom;
          transition: transform .9s cubic-bezier(.34,1.2,.4,1);
          border-radius: 16px 16px 6px 6px;
          background: linear-gradient(180deg, #8a4a17 0%, #6d370f 100%);
          border: 3px solid #2c1606;
          box-shadow: inset 0 6px 14px rgba(255,220,150,.15), inset 0 -8px 14px rgba(0,0,0,.4);
        }
        .bau-banda-tampa {
          position: absolute; top: 0; bottom: 0; width: 12px; margin-left: -6px;
          background: linear-gradient(90deg, #b45309, #fbbf24 45%, #92400e);
          box-shadow: inset 0 0 4px rgba(0,0,0,.4);
        }

        .bau-cadeado {
          position: absolute; top: 92px; left: 50%; width: 46px; height: 46px;
          margin-left: -23px; border-radius: 10px; z-index: 5;
          display: flex; align-items: center; justify-content: center;
          color: #3f1e08;
          background: linear-gradient(180deg, #fde68a, #f59e0b);
          border: 2px solid #7c2d12;
          box-shadow: 0 0 14px rgba(251,191,36,.55);
          animation: bau-tremor 2.4s ease-in-out infinite;
          transition: transform .6s ease, opacity .6s ease;
        }
        @keyframes bau-tremor {
          0%,92%,100% { transform: rotate(0); }
          94% { transform: rotate(-7deg); } 96% { transform: rotate(6deg); } 98% { transform: rotate(-3deg); }
        }
        .bau-cadeado.nega {
          color: #7f1d1d;
          background: linear-gradient(180deg, #fca5a5, #ef4444);
          border-color: #7f1d1d;
          box-shadow: 0 0 16px rgba(239,68,68,.7);
          animation: bau-nega .5s;
        }
        @keyframes bau-nega {
          0%,100% { transform: translateX(0); }
          15% { transform: translateX(-8px) rotate(-6deg); }
          30% { transform: translateX(8px) rotate(6deg); }
          45% { transform: translateX(-7px) rotate(-5deg); }
          60% { transform: translateX(7px) rotate(4deg); }
          75% { transform: translateX(-4px) rotate(-2deg); }
        }
        /* Estilhaços do cadeado */
        .bau-estilhacos { position: absolute; top: 96px; left: 50%; z-index: 7; pointer-events: none; }
        .bau-estilhaco {
          position: absolute; top: 0; left: 0; margin-left: -9px; width: 18px; height: 18px;
          background: linear-gradient(160deg, #fde68a, #f59e0b 55%, #b45309);
          border: 2px solid #7c2d12;
          clip-path: polygon(50% 0, 100% 36%, 82% 100%, 18% 100%, 0 36%);
          box-shadow: 0 0 8px rgba(251,191,36,.55);
          animation-name: bau-estilhaco; animation-timing-function: cubic-bezier(.3,.7,.35,1);
          animation-fill-mode: forwards;
        }
        @keyframes bau-estilhaco {
          0% { transform: translate(0,0) rotate(0deg); opacity: 1; }
          22% { transform: translate(calc(var(--tx) * .5), -38px) rotate(calc(var(--r) * .4deg)); opacity: 1; }
          100% { transform: translate(var(--tx), 158px) rotate(calc(var(--r) * 1deg)); opacity: 0; }
        }

        /* Moedas a saltar */
        .bau-moedas { position: absolute; top: 70px; left: 50%; z-index: 6; pointer-events: none; }
        .bau-moeda {
          position: absolute; top: 0; left: 0; margin-left: -12px; width: 24px; height: 24px;
          border-radius: 9999px;
          background:
            radial-gradient(circle at 38% 32%, #fffbe6, #fcd34d 46%, #d97706 78%, #92400e 100%);
          border: 1.5px solid #b45309;
          box-shadow: 0 0 10px rgba(251,191,36,.6), inset 0 0 4px rgba(255,255,255,.5);
          opacity: 0; animation-name: bau-moeda; animation-timing-function: cubic-bezier(.25,.6,.4,1);
          animation-fill-mode: forwards;
        }
        .bau-moeda::after {
          content: ""; position: absolute; inset: 5px; border-radius: 9999px;
          border: 1.5px solid rgba(146,64,14,.5);
        }
        @keyframes bau-moeda {
          0% { transform: translate(0,0) rotateY(0deg) scale(.5); opacity: 0; }
          12% { opacity: 1; }
          45% { transform: translate(calc(var(--cx) * .6), var(--peak)) rotateY(calc(var(--rot) * .5)) scale(1); opacity: 1; }
          100% { transform: translate(var(--cx), 210px) rotateY(var(--rot)) scale(.9); opacity: 0; }
        }

        .bau-bloco {
          height: 58px; text-align: center; text-transform: uppercase;
          font-size: 24px; font-weight: 800; letter-spacing: .08em;
          color: #fff7e0; caret-color: #fbbf24;
          background: rgba(255,255,255,.06);
          border: 2px solid rgba(251,191,36,.35);
          border-radius: 12px; outline: none;
          box-shadow: inset 0 2px 6px rgba(0,0,0,.35);
          transition: border-color .2s, background .2s, box-shadow .2s, transform .1s;
        }
        .bau-bloco:focus { border-color: #fbbf24; box-shadow: 0 0 0 3px rgba(251,191,36,.25); }
        .bau-bloco.cheio {
          color: #fff7e0; background: rgba(251,191,36,.12);
          border-color: rgba(251,191,36,.6);
        }
        .bau-bloco.err {
          color: #fecaca; border-color: #ef4444; background: rgba(239,68,68,.16);
          box-shadow: 0 0 14px rgba(239,68,68,.4); animation: bau-shake .4s;
        }
        @keyframes bau-shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-6px); } 40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); } 80% { transform: translateX(4px); }
        }

        .bau-faisca {
          position: absolute; bottom: 40%; border-radius: 9999px;
          background: radial-gradient(circle, #fff6cf, #fbbf24 60%, transparent 75%);
          animation: bau-sobe ease-out infinite; opacity: 0;
        }
        @keyframes bau-sobe {
          0% { transform: translateY(0) scale(.6); opacity: 0; }
          15% { opacity: 1; }
          100% { transform: translateY(-240px) scale(1); opacity: 0; }
        }
        .bau-vitoria { animation: bau-aparece .6s ease both .2s; }
        @keyframes bau-aparece { from { opacity: 0; transform: translateY(10px);} to { opacity:1; transform: none;} }

        /* Nome do vencedor em letras garrafais (na cor da equipa) */
        .bau-vencedor {
          font-weight: 900; line-height: .95; letter-spacing: -0.02em;
          font-size: clamp(2.75rem, 12vw, 8rem);
          text-transform: uppercase;
          text-shadow: 0 0 42px currentColor, 0 6px 34px rgba(0,0,0,.55);
          animation: bau-vencedor-in .7s cubic-bezier(.2,1.5,.4,1) both;
        }
        @keyframes bau-vencedor-in {
          0% { opacity: 0; transform: scale(.6); }
          60% { opacity: 1; }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

/* ==================== Projeção do QR em ecrã cheio ===================== */

function QrProjecao({
  url,
  qr,
  titulo,
  onClose,
}: {
  url: string;
  qr: string;
  titulo: string;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fs, setFs] = useState(false);

  useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Fecha com ESC (quando não está em fullscreen nativo).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function toggleFs() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await ref.current?.requestFullscreen();
    } catch {
      /* alguns browsers bloqueiam sem gesto — ignora */
    }
  }

  return (
    <div
      ref={ref}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-6 bg-white px-6 py-8"
    >
      <div className="absolute right-4 top-4 flex gap-2">
        <button
          onClick={toggleFs}
          title="Ecrã cheio"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
        >
          <Maximize className="h-5 w-5" />
        </button>
        <button
          onClick={() => {
            if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
            onClose();
          }}
          title="Fechar"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-brand-500">
          Lê o QR Code para responder
        </p>
        <h1 className="mt-1 text-3xl font-black text-navy sm:text-5xl">{titulo}</h1>
      </div>

      {qr && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={qr}
          alt="QR Code do quiz"
          className="h-[55vh] max-h-[70vw] w-auto max-w-full rounded-2xl border border-slate-200 shadow-lg"
        />
      )}

      <p className="max-w-xl text-center text-lg text-slate-500">
        Aponta a câmara do telemóvel ao código, escolhe a tua equipa e o teu
        nome, e responde o mais rápido e certo possível!
      </p>
      <p className="text-sm text-slate-400">{url}</p>

      {!fs && (
        <button
          onClick={toggleFs}
          className="mt-2 inline-flex items-center gap-2 rounded-full bg-navy px-5 py-2 text-sm font-semibold text-white transition hover:opacity-90"
        >
          <Maximize className="h-4 w-4" /> Entrar em ecrã cheio
        </button>
      )}
    </div>
  );
}

type OpcaoEdit = { texto: string; correta: boolean };
type PerguntaEdit = { enunciado: string; opcoes: OpcaoEdit[] };
type CartaoEdit = { codigo: string; etiqueta: string; equipaId: string };

function novoCartao(): CartaoEdit {
  return { codigo: "", etiqueta: "", equipaId: "" };
}

function novaPergunta(): PerguntaEdit {
  return {
    enunciado: "",
    opcoes: [
      { texto: "", correta: true },
      { texto: "", correta: false },
    ],
  };
}

function DinamicaForm({
  eventoId,
  equipas,
  dinamica,
  onClose,
  onSaved,
}: {
  eventoId: string;
  equipas: Equipa[];
  dinamica: Dinamica | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(dinamica?.nome ?? "");
  const [descricao, setDescricao] = useState(dinamica?.descricao ?? "");
  const [peso, setPeso] = useState(String(dinamica?.peso ?? 1));
  const [tipo, setTipo] = useState<"manual" | "quiz" | "tesouro" | "grito">(
    dinamica?.tipo === "quiz"
      ? "quiz"
      : dinamica?.tipo === "tesouro"
        ? "tesouro"
        : dinamica?.tipo === "grito"
          ? "grito"
          : "manual"
  );
  const [valorPorAcerto, setValorPorAcerto] = useState(
    String(dinamica?.valorPorAcerto ?? 10)
  );
  const [valorPorVoto, setValorPorVoto] = useState(
    String(dinamica?.valorPorVoto ?? 10)
  );
  const [valorTesouro, setValorTesouro] = useState(
    String(dinamica?.valorTesouro ?? 50)
  );
  const [bonusRapidezMax, setBonusRapidezMax] = useState(
    String(dinamica?.bonusRapidezMax ?? 20)
  );
  const [tempoLimiteSeg, setTempoLimiteSeg] = useState(
    dinamica?.tempoLimiteSeg != null ? String(dinamica.tempoLimiteSeg) : ""
  );
  const [perguntas, setPerguntas] = useState<PerguntaEdit[]>(
    dinamica?.perguntas?.length
      ? dinamica.perguntas.map((p) => ({
          enunciado: p.enunciado,
          opcoes: p.opcoes.map((o) => ({ texto: o.texto, correta: o.correta })),
        }))
      : [novaPergunta()]
  );
  const [cartoes, setCartoes] = useState<CartaoEdit[]>(
    dinamica?.cartoesTesouro?.length
      ? dinamica.cartoesTesouro.map((c) => ({
          codigo: c.codigo,
          etiqueta: c.etiqueta ?? "",
          equipaId: c.equipaId ?? "",
        }))
      : [novoCartao()]
  );
  const [saving, setSaving] = useState(false);

  const quizInvalido =
    tipo === "quiz" &&
    !perguntas.some(
      (p) =>
        p.enunciado.trim() &&
        p.opcoes.filter((o) => o.texto.trim()).length >= 2 &&
        p.opcoes.some((o) => o.correta && o.texto.trim())
    );

  const tesouroInvalido =
    tipo === "tesouro" && !cartoes.some((c) => c.codigo.trim());

  async function salvar() {
    if (!nome.trim()) return;
    if (tipo === "quiz" && quizInvalido) {
      toast.error(
        "Cada pergunta precisa de enunciado, ≥2 opções e uma opção correta."
      );
      return;
    }
    if (tipo === "tesouro" && tesouroInvalido) {
      toast.error("Adiciona pelo menos um cartão com código.");
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        eventoId,
        nome: nome.trim(),
        descricao: descricao.trim() || null,
        peso: Number(peso) || 1,
        tipo,
      };
      if (tipo === "quiz") {
        payload.valorPorAcerto = Number(valorPorAcerto);
        payload.bonusRapidezMax = Number(bonusRapidezMax);
        payload.tempoLimiteSeg = tempoLimiteSeg.trim() || null;
        payload.perguntas = perguntas
          .filter((p) => p.enunciado.trim())
          .map((p) => ({
            enunciado: p.enunciado.trim(),
            opcoes: p.opcoes
              .filter((o) => o.texto.trim())
              .map((o) => ({ texto: o.texto.trim(), correta: o.correta })),
          }));
      } else if (tipo === "tesouro") {
        payload.valorTesouro = Number(valorTesouro) || 50;
        payload.cartoes = cartoes
          .filter((c) => c.codigo.trim())
          .map((c) => ({
            codigo: c.codigo.trim(),
            etiqueta: c.etiqueta.trim() || null,
            equipaId: c.equipaId || null,
          }));
      } else if (tipo === "grito") {
        payload.valorPorVoto = Number(valorPorVoto) || 10;
      }
      await api(
        dinamica
          ? `/api/gamificacao/dinamicas/${dinamica.id}`
          : "/api/gamificacao/dinamicas",
        {
          method: dinamica ? "PUT" : "POST",
          body: JSON.stringify(payload),
        }
      );
      toast.success(dinamica ? "Dinâmica actualizada" : "Dinâmica criada");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  /* --- helpers do editor de perguntas --- */
  function updPergunta(i: number, patch: Partial<PerguntaEdit>) {
    setPerguntas((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function updOpcao(pi: number, oi: number, patch: Partial<OpcaoEdit>) {
    setPerguntas((ps) =>
      ps.map((p, idx) =>
        idx === pi
          ? {
              ...p,
              opcoes: p.opcoes.map((o, j) =>
                j === oi ? { ...o, ...patch } : o
              ),
            }
          : p
      )
    );
  }
  function marcarCorreta(pi: number, oi: number) {
    setPerguntas((ps) =>
      ps.map((p, idx) =>
        idx === pi
          ? { ...p, opcoes: p.opcoes.map((o, j) => ({ ...o, correta: j === oi })) }
          : p
      )
    );
  }

  return (
    <Modal
      title={dinamica ? "Editar dinâmica" : "Nova dinâmica"}
      onClose={onClose}
      maxWidth={
        tipo === "manual" || tipo === "grito" ? "max-w-md" : "max-w-2xl"
      }
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button variant="navy" onClick={salvar} disabled={saving || !nome.trim()}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <Label className="mb-1 block">Nome da dinâmica *</Label>
          <Input
            autoFocus
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Ex.: Caça ao tesouro"
          />
        </div>
        <div>
          <Label className="mb-1 block">Descrição</Label>
          <Textarea
            rows={2}
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Opcional"
          />
        </div>
        <div>
          <Label className="mb-1 block">Multiplicador de pontos</Label>
          <Input
            type="number"
            min="0.1"
            step="0.5"
            value={peso}
            onChange={(e) => setPeso(e.target.value)}
          />
          <p className="mt-1 text-xs text-slate-400">
            Peso desta dinâmica no ranking (1 = normal, 2 = pontos a dobrar).
          </p>
        </div>

        <div>
          <Label className="mb-1 block">Tipo de dinâmica</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setTipo("manual")}
              className={`rounded-lg border-2 px-3 py-2 text-left text-sm transition ${
                tipo === "manual"
                  ? "border-brand-500 bg-brand-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <span className="font-semibold text-navy">Manual</span>
              <span className="block text-xs text-slate-400">
                Pontuação lançada à mão
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTipo("quiz")}
              className={`rounded-lg border-2 px-3 py-2 text-left text-sm transition ${
                tipo === "quiz"
                  ? "border-brand-500 bg-brand-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <span className="font-semibold text-navy">Quiz (QR Code)</span>
              <span className="block text-xs text-slate-400">
                Membros respondem pelo telemóvel
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTipo("tesouro")}
              className={`rounded-lg border-2 px-3 py-2 text-left text-sm transition ${
                tipo === "tesouro"
                  ? "border-brand-500 bg-brand-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <span className="font-semibold text-navy">Caça ao Tesouro</span>
              <span className="block text-xs text-slate-400">
                Reunir códigos para abrir o baú
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTipo("grito")}
              className={`rounded-lg border-2 px-3 py-2 text-left text-sm transition ${
                tipo === "grito"
                  ? "border-brand-500 bg-brand-50"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <span className="font-semibold text-navy">Grito de Guerra</span>
              <span className="block text-xs text-slate-400">
                Votação por QR: vence o mais votado
              </span>
            </button>
          </div>
        </div>

        {tipo === "grito" && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-xs text-slate-500">
              Partilha um único QR Code. Cada grupo lê, escolhe o seu grupo e vota
              no melhor grito de guerra de <strong>outro</strong> grupo. Só é
              permitido <strong>um voto por grupo</strong> (o primeiro a votar
              decide). Vence o grupo mais votado; havendo empate no topo, não há
              vencedor. Só o vencedor pontua.
            </p>
            <div className="max-w-[12rem]">
              <Label className="mb-1 block text-xs">Pontos por voto</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={valorPorVoto}
                onChange={(e) => setValorPorVoto(e.target.value)}
              />
              <p className="mt-1 text-xs text-slate-400">
                Pontos do vencedor = nº de votos × este valor.
              </p>
            </div>
          </div>
        )}

        {tipo === "quiz" && (
          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            {/* Config de pontuação */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="mb-1 block text-xs">Pontos/acerto</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={valorPorAcerto}
                  onChange={(e) => setValorPorAcerto(e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1 block text-xs">Bónus rapidez</Label>
                <Input
                  type="number"
                  min="0"
                  step="1"
                  value={bonusRapidezMax}
                  onChange={(e) => setBonusRapidezMax(e.target.value)}
                />
              </div>
              <div>
                <Label className="mb-1 flex items-center gap-1 text-xs">
                  <Timer className="h-3 w-3" /> Tempo (s)
                </Label>
                <Input
                  type="number"
                  min="0"
                  step="5"
                  placeholder="s/ limite"
                  value={tempoLimiteSeg}
                  onChange={(e) => setTempoLimiteSeg(e.target.value)}
                />
              </div>
            </div>
            <p className="-mt-2 text-xs text-slate-400">
              Pontos = acertos × pontos/acerto + bónus (só com limite de tempo:
              quanto mais rápido e certo, maior o bónus). A pontuação da equipa é
              a soma dos membros. O <strong>Tempo (s)</strong> é o que cada
              pessoa tem para responder a <strong>cada pergunta</strong>: ao
              esgotar, avança automaticamente para a seguinte.
            </p>

            {/* Perguntas */}
            <div className="space-y-3">
              {perguntas.map((p, pi) => (
                <div
                  key={pi}
                  className="rounded-lg border border-slate-200 bg-white p-3"
                >
                  <div className="mb-2 flex items-start gap-2">
                    <span className="mt-1.5 text-xs font-bold text-slate-400">
                      {pi + 1}.
                    </span>
                    <Textarea
                      rows={2}
                      value={p.enunciado}
                      onChange={(e) =>
                        updPergunta(pi, { enunciado: e.target.value })
                      }
                      placeholder="Enunciado da pergunta"
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                      onClick={() =>
                        setPerguntas((ps) => ps.filter((_, idx) => idx !== pi))
                      }
                      disabled={perguntas.length === 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="space-y-1.5 pl-5">
                    {p.opcoes.map((o, oi) => (
                      <div key={oi} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => marcarCorreta(pi, oi)}
                          title="Marcar como correta"
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition ${
                            o.correta
                              ? "border-green-500 bg-green-500 text-white"
                              : "border-slate-300 hover:border-green-400"
                          }`}
                        >
                          {o.correta && <Check className="h-4 w-4" />}
                        </button>
                        <Input
                          value={o.texto}
                          onChange={(e) =>
                            updOpcao(pi, oi, { texto: e.target.value })
                          }
                          placeholder={`Opção ${oi + 1}`}
                          className="h-9"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 shrink-0 text-slate-400"
                          onClick={() =>
                            updPergunta(pi, {
                              opcoes: p.opcoes.filter((_, j) => j !== oi),
                            })
                          }
                          disabled={p.opcoes.length <= 2}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="text-brand-600"
                      onClick={() =>
                        updPergunta(pi, {
                          opcoes: [...p.opcoes, { texto: "", correta: false }],
                        })
                      }
                    >
                      <Plus className="h-4 w-4" /> Opção
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setPerguntas((ps) => [...ps, novaPergunta()])}
              >
                <Plus className="h-4 w-4" /> Adicionar pergunta
              </Button>
            </div>
          </div>
        )}

        {tipo === "tesouro" && (
          <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
            <p className="text-xs text-slate-500">
              Cada cartão é um <strong>bloco da chave</strong> (ex.: A1, B2, …).
              As equipas reúnem os blocos e, pelo QR, inserem a combinação
              completa — <strong>pela ordem em que os cartões estão aqui</strong>.
              A <strong>1ª equipa a acertar</strong> abre o baú e ganha os pontos.
              Etiqueta e envelope são opcionais (para te organizares).
            </p>

            <div className="max-w-[12rem]">
              <Label className="mb-1 block text-xs">Pontos ao vencedor</Label>
              <Input
                type="number"
                min="0"
                step="1"
                value={valorTesouro}
                onChange={(e) => setValorTesouro(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              {cartoes.map((c, ci) => (
                <div key={ci} className="flex items-center gap-2">
                  <span className="w-5 shrink-0 text-xs font-bold text-slate-400">
                    {ci + 1}.
                  </span>
                  <Input
                    value={c.codigo}
                    onChange={(e) =>
                      setCartoes((cs) =>
                        cs.map((x, j) =>
                          j === ci
                            ? { ...x, codigo: e.target.value.toUpperCase() }
                            : x
                        )
                      )
                    }
                    placeholder="Código (ex.: AZUL42)"
                    className="h-9 flex-1 font-mono"
                  />
                  <Input
                    value={c.etiqueta}
                    onChange={(e) =>
                      setCartoes((cs) =>
                        cs.map((x, j) =>
                          j === ci ? { ...x, etiqueta: e.target.value } : x
                        )
                      )
                    }
                    placeholder="Etiqueta"
                    className="h-9 w-28 shrink-0"
                  />
                  <select
                    value={c.equipaId}
                    onChange={(e) =>
                      setCartoes((cs) =>
                        cs.map((x, j) =>
                          j === ci ? { ...x, equipaId: e.target.value } : x
                        )
                      )
                    }
                    className="h-9 w-28 shrink-0 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 outline-none focus:border-slate-400"
                  >
                    <option value="">— Envelope —</option>
                    {equipas.map((eq) => (
                      <option key={eq.id} value={eq.id}>
                        {eq.nome}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 shrink-0 text-destructive hover:text-destructive"
                    onClick={() =>
                      setCartoes((cs) => cs.filter((_, j) => j !== ci))
                    }
                    disabled={cartoes.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setCartoes((cs) => [...cs, novoCartao()])}
            >
              <Plus className="h-4 w-4" /> Adicionar cartão
            </Button>

            <p className="text-xs text-slate-400">
              {cartoes.filter((c) => c.codigo.trim()).length} código(s)
              definido(s).
            </p>
          </div>
        )}
      </div>
    </Modal>
  );
}

/* ============================ Lançar pontos ============================== */

function PontosTab({
  evento,
  onSaved,
}: {
  evento: Evento;
  onSaved: () => void;
}) {
  // Todas as dinâmicas aparecem na grelha. As manuais são editáveis; as de quiz
  // e grito entram só para leitura (pontuadas automaticamente pelas respostas /
  // votos), para se ver o contributo delas no total por equipa.
  const ehAuto = (t: string) =>
    t === "quiz" || t === "grito" || t === "tesouro";
  const todas = useMemo(() => evento.dinamicas, [evento]);
  const manuais = useMemo(
    () => todas.filter((d) => !ehAuto(d.tipo)),
    [todas]
  );
  // Pontos automáticos por célula (dinâmica+equipa), da Classificacao calculada.
  const quizPts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const d of todas) {
      if (!ehAuto(d.tipo)) continue;
      for (const c of d.classificacoes) {
        map[cellKey(d.id, c.equipaId)] = c.pontos;
      }
    }
    return map;
  }, [todas]);

  // Valor original (do servidor) por célula.
  const original = useMemo(() => {
    const map: Record<string, string> = {};
    for (const d of manuais) {
      for (const c of d.classificacoes) {
        map[cellKey(d.id, c.equipaId)] = String(c.pontos);
      }
    }
    return map;
  }, [manuais]);

  const [grid, setGrid] = useState<Record<string, string>>(original);
  const [saving, setSaving] = useState(false);

  useEffect(() => setGrid(original), [original]);

  const dirty = useMemo(
    () =>
      Object.keys({ ...original, ...grid }).some(
        (k) => (grid[k] ?? "") !== (original[k] ?? "")
      ),
    [grid, original]
  );

  const totais = useMemo(() => {
    const t: Record<string, number> = {};
    for (const eq of evento.equipas) t[eq.id] = 0;
    for (const d of todas) {
      const auto = ehAuto(d.tipo);
      for (const eq of evento.equipas) {
        const k = cellKey(d.id, eq.id);
        const v = auto ? quizPts[k] ?? 0 : Number(grid[k] ?? 0) || 0;
        t[eq.id] += v * (d.peso ?? 1);
      }
    }
    return t;
  }, [grid, evento.equipas, todas, quizPts]);

  async function salvar() {
    const lancamentos: { dinamicaId: string; equipaId: string; pontos: number }[] =
      [];
    for (const d of manuais) {
      for (const eq of evento.equipas) {
        const k = cellKey(d.id, eq.id);
        if ((grid[k] ?? "") !== (original[k] ?? "")) {
          lancamentos.push({
            dinamicaId: d.id,
            equipaId: eq.id,
            pontos: Number(grid[k] ?? 0) || 0,
          });
        }
      }
    }
    if (!lancamentos.length) return;
    setSaving(true);
    try {
      await api("/api/gamificacao/classificacoes", {
        method: "POST",
        body: JSON.stringify({ lancamentos }),
      });
      toast.success("Pontuações guardadas");
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (evento.equipas.length === 0 || todas.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-slate-400">
          Cria pelo menos uma equipa e uma dinâmica para lançar pontuações.
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Lança a pontuação de cada equipa nas dinâmicas manuais. As de quiz e
          grito (a cinzento) são automáticas e já contam para o total. A posição
          sai do total.
        </p>
        <Button variant="navy" onClick={salvar} disabled={!dirty || saving}>
          <Save /> {saving ? "Guardando…" : "Guardar pontuações"}
        </Button>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50">
                <th className="sticky left-0 z-10 bg-slate-50 px-3 py-2.5 text-left font-semibold text-slate-600">
                  Dinâmica
                </th>
                {evento.equipas.map((eq) => (
                  <th key={eq.id} className="px-2 py-2.5 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ background: eq.cor }}
                      />
                      <span className="max-w-[6rem] truncate font-semibold text-slate-700">
                        {eq.nome}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {todas.map((d) => {
                const auto = ehAuto(d.tipo);
                const ehGrito = d.tipo === "grito";
                const ehTesouro = d.tipo === "tesouro";
                return (
                  <tr key={d.id} className="border-t border-slate-100">
                    <td className="sticky left-0 z-10 bg-white px-3 py-2">
                      <div className="flex items-center gap-1.5 font-medium text-slate-700">
                        {d.nome}
                        {auto && (
                          <Badge variant="secondary" className="font-normal">
                            {ehGrito ? (
                              <>
                                <Megaphone className="mr-1 h-3 w-3" /> grito
                              </>
                            ) : ehTesouro ? (
                              <>
                                <KeyRound className="mr-1 h-3 w-3" /> tesouro
                              </>
                            ) : (
                              <>
                                <QrCode className="mr-1 h-3 w-3" /> quiz
                              </>
                            )}
                          </Badge>
                        )}
                      </div>
                      {auto ? (
                        <div className="text-xs text-slate-400">
                          {ehGrito
                            ? "automático (pelos votos)"
                            : ehTesouro
                              ? "automático (pelo vencedor)"
                              : "automático (pelas respostas)"}
                          {d.peso !== 1 ? ` · ×${nf(d.peso)}` : ""}
                        </div>
                      ) : (
                        d.peso !== 1 && (
                          <div className="text-xs text-slate-400">
                            multiplicador ×{nf(d.peso)}
                          </div>
                        )
                      )}
                    </td>
                    {evento.equipas.map((eq) => {
                      const k = cellKey(d.id, eq.id);
                      return (
                        <td key={eq.id} className="px-2 py-1.5 text-center">
                          {auto ? (
                            <input
                              type="text"
                              value={nf(quizPts[k] ?? 0)}
                              readOnly
                              disabled
                              title="Pontuação automática (não editável)"
                              className="h-9 w-20 cursor-not-allowed rounded-md border border-slate-100 bg-slate-50 text-center text-slate-400"
                            />
                          ) : (
                            <input
                              type="number"
                              step="any"
                              value={grid[k] ?? ""}
                              onChange={(e) =>
                                setGrid((g) => ({ ...g, [k]: e.target.value }))
                              }
                              placeholder="0"
                              className="h-9 w-20 rounded-md border border-slate-200 bg-white text-center text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                            />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50">
                <td className="sticky left-0 z-10 bg-slate-50 px-3 py-2.5 font-semibold text-navy">
                  Total
                </td>
                {evento.equipas.map((eq) => (
                  <td
                    key={eq.id}
                    className="px-2 py-2.5 text-center text-base font-bold text-navy"
                  >
                    {nf(totais[eq.id] ?? 0)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* ============================== Ranking ================================= */

function RankingTab({
  eventoId,
  ranking,
  onChange,
}: {
  eventoId: string;
  ranking: LinhaRanking[];
  onChange: () => void;
}) {
  const [repor, setRepor] = useState(false);
  const [busy, setBusy] = useState(false);
  const max = Math.max(1, ...ranking.map((r) => r.total));
  const temPontos = ranking.some((r) => r.total !== 0);

  async function reporRanking() {
    setBusy(true);
    try {
      const r = await api<{
        respostasApagadas: number;
        classificacoesApagadas: number;
      }>(`/api/gamificacao/eventos/${eventoId}/repor-ranking`, {
        method: "POST",
      });
      toast.success(
        `Ranking reposto (${r.classificacoesApagadas} pontuações e ${r.respostasApagadas} respostas apagadas)`
      );
      setRepor(false);
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (ranking.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-slate-400">
          Sem equipas ainda.
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap justify-end gap-2">
        {temPontos && (
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700"
            onClick={() => setRepor(true)}
          >
            <Trash2 /> Repor ranking
          </Button>
        )}
        <Button asChild variant="outline" size="sm">
          <Link href={`/gamificacao/${eventoId}/ranking`}>
            <Trophy /> Ver em ecrã cheio
          </Link>
        </Button>
      </div>
      {repor && (
        <ConfirmDialog
          title="Repor ranking do evento?"
          message="Vais apagar TODAS as pontuações (lançadas à mão e de quiz) e TODAS as respostas de TODAS as dinâmicas deste evento. O ranking fica a zero. Esta acção não pode ser anulada."
          confirmLabel="Repor ranking"
          danger
          busy={busy}
          onConfirm={reporRanking}
          onCancel={() => setRepor(false)}
        />
      )}
      <Card>
        <CardContent className="space-y-2 p-4">
          {ranking.map((r) => (
            <div key={r.equipaId} className="flex items-center gap-3">
              <div className="flex w-8 shrink-0 justify-center">
                {r.posicao === 1 ? (
                  <Crown className="h-5 w-5 text-amber-500" />
                ) : r.posicao <= 3 ? (
                  <Medal
                    className={`h-5 w-5 ${
                      r.posicao === 2 ? "text-slate-400" : "text-amber-700"
                    }`}
                  />
                ) : (
                  <span className="text-sm font-bold text-slate-400">
                    {r.posicao}º
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <span className="truncate font-semibold text-navy">
                    {r.nome}
                  </span>
                  <span className="shrink-0 font-bold text-navy">
                    {nf(r.total)}
                  </span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${(r.total / max) * 100}%`,
                      background: r.cor,
                    }}
                  />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
