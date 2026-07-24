"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
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
  Check,
  Copy,
  Crown,
  Gamepad2,
  ListChecks,
  Medal,
  Pencil,
  Plus,
  QrCode,
  Radio,
  Save,
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
type Dinamica = {
  id: string;
  nome: string;
  descricao: string | null;
  peso: number;
  ordem: number;
  tipo: string; // "manual" | "quiz"
  quizAberto: boolean;
  valorPorAcerto: number;
  bonusRapidezMax: number;
  tempoLimiteSeg: number | null;
  classificacoes: Classificacao[];
  perguntas: QuizPergunta[];
  submissoes: QuizSubmissao[];
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
        <TabsContent value="dinamicas">
          <DinamicasTab evento={evento} onChange={carregar} />
        </TabsContent>
        <TabsContent value="pontos">
          <PontosTab evento={evento} onSaved={carregar} />
        </TabsContent>
        <TabsContent value="ranking">
          <RankingTab eventoId={id} ranking={ranking} />
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
  const [busy, setBusy] = useState(false);

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
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-sm font-bold text-brand-700">
                  {i + 1}
                </span>
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
                </div>
                <div className="flex gap-1 md:opacity-0 md:transition md:group-hover:opacity-100">
                  {d.tipo === "quiz" && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-brand-600 opacity-100"
                      title="QR Code e controlo"
                      onClick={() => setControlo(d)}
                    >
                      <QrCode className="h-4 w-4" />
                    </Button>
                  )}
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <DinamicaForm
          eventoId={evento.id}
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
      {controlo && (
        <QuizControloModal
          dinamica={controlo}
          onClose={() => setControlo(null)}
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
  const [copiado, setCopiado] = useState(false);
  const [submissoes, setSubmissoes] = useState<
    { id: string; nomeMembro: string; certas: number; totalPerguntas: number; pontos: number; equipa: { nome: string; cor: string } }[]
  >([]);
  const [busy, setBusy] = useState(false);

  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/q/${dinamica.id}`
      : `/q/${dinamica.id}`;

  useEffect(() => {
    QRCode.toDataURL(url, { width: 320, margin: 1 })
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
            Projeta ou imprime este QR Code. Cada membro lê, escolhe a equipa,
            escreve o nome e responde.
          </p>
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

        <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
          <div>
            <p className="text-sm font-semibold text-navy">
              {aberto ? "Aberto a respostas" : "Fechado"}
            </p>
            <p className="text-xs text-slate-400">
              {aberto
                ? "Os membros já podem responder."
                : "Abre quando quiseres começar."}
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
          {submissoes.length === 0 ? (
            <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-400">
              Ainda sem respostas.
            </p>
          ) : (
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

type OpcaoEdit = { texto: string; correta: boolean };
type PerguntaEdit = { enunciado: string; opcoes: OpcaoEdit[] };

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
  dinamica,
  onClose,
  onSaved,
}: {
  eventoId: string;
  dinamica: Dinamica | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [nome, setNome] = useState(dinamica?.nome ?? "");
  const [descricao, setDescricao] = useState(dinamica?.descricao ?? "");
  const [peso, setPeso] = useState(String(dinamica?.peso ?? 1));
  const [tipo, setTipo] = useState<"manual" | "quiz">(
    dinamica?.tipo === "quiz" ? "quiz" : "manual"
  );
  const [valorPorAcerto, setValorPorAcerto] = useState(
    String(dinamica?.valorPorAcerto ?? 10)
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
  const [saving, setSaving] = useState(false);

  const quizInvalido =
    tipo === "quiz" &&
    !perguntas.some(
      (p) =>
        p.enunciado.trim() &&
        p.opcoes.filter((o) => o.texto.trim()).length >= 2 &&
        p.opcoes.some((o) => o.correta && o.texto.trim())
    );

  async function salvar() {
    if (!nome.trim()) return;
    if (tipo === "quiz" && quizInvalido) {
      toast.error(
        "Cada pergunta precisa de enunciado, ≥2 opções e uma opção correta."
      );
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
          <div className="grid grid-cols-2 gap-2">
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
          </div>
        </div>

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
              a soma dos membros.
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
  // Só dinâmicas manuais — as de quiz são pontuadas automaticamente.
  const manuais = useMemo(
    () => evento.dinamicas.filter((d) => d.tipo !== "quiz"),
    [evento]
  );

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
    for (const d of manuais) {
      for (const eq of evento.equipas) {
        const v = Number(grid[cellKey(d.id, eq.id)] ?? 0) || 0;
        t[eq.id] += v * (d.peso ?? 1);
      }
    }
    return t;
  }, [grid, evento.equipas, manuais]);

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

  if (evento.equipas.length === 0 || manuais.length === 0) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-slate-400">
          {evento.equipas.length === 0
            ? "Cria pelo menos uma equipa e uma dinâmica para lançar pontuações."
            : "Não há dinâmicas manuais. As dinâmicas de quiz são pontuadas automaticamente pelas respostas."}
        </CardContent>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Lança a pontuação de cada equipa em cada dinâmica. A posição sai
          automaticamente do total.
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
              {manuais.map((d) => (
                <tr key={d.id} className="border-t border-slate-100">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2">
                    <div className="font-medium text-slate-700">{d.nome}</div>
                    {d.peso !== 1 && (
                      <div className="text-xs text-slate-400">
                        multiplicador ×{nf(d.peso)}
                      </div>
                    )}
                  </td>
                  {evento.equipas.map((eq) => {
                    const k = cellKey(d.id, eq.id);
                    return (
                      <td key={eq.id} className="px-2 py-1.5 text-center">
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
                      </td>
                    );
                  })}
                </tr>
              ))}
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
}: {
  eventoId: string;
  ranking: LinhaRanking[];
}) {
  const max = Math.max(1, ...ranking.map((r) => r.total));

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
      <div className="mb-3 flex justify-end">
        <Button asChild variant="outline" size="sm">
          <Link href={`/gamificacao/${eventoId}/ranking`}>
            <Trophy /> Ver em ecrã cheio
          </Link>
        </Button>
      </div>
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
