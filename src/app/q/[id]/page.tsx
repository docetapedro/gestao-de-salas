"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { api } from "@/lib/api";
import { CheckCircle2, Clock, Loader2, Trophy } from "lucide-react";

type Opcao = { id: string; texto: string };
type Pergunta = { id: string; enunciado: string; opcoes: Opcao[] };
type Equipa = { id: string; nome: string; cor: string };
type Quiz = {
  id: string;
  nome: string;
  descricao: string | null;
  aberto: boolean;
  tempoLimiteSeg: number | null;
  evento: { nome: string; local: string | null } | null;
  perguntas: Pergunta[];
};

type Fase = "intro" | "quiz" | "fim";

function nf(n: number) {
  return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 }).format(n);
}

export default function QuizPublicoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [equipas, setEquipas] = useState<Equipa[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [fase, setFase] = useState<Fase>("intro");
  const [equipaId, setEquipaId] = useState("");
  const [nome, setNome] = useState("");

  // Respostas: perguntaId -> opcaoId
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [idx, setIdx] = useState(0);
  const inicioRef = useRef<number>(0);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<{
    certas: number;
    totalPerguntas: number;
    pontos: number;
  } | null>(null);

  const carregar = useCallback(async () => {
    try {
      const d = await api<{ quiz: Quiz; equipas: Equipa[] }>(
        `/api/public/quiz/${id}`
      );
      setQuiz(d.quiz);
      setEquipas(d.equipas);
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const submeter = useCallback(async () => {
    if (!quiz || enviando) return;
    setEnviando(true);
    const tempoMs = Date.now() - inicioRef.current;
    try {
      const r = await api<{
        certas: number;
        totalPerguntas: number;
        pontos: number;
      }>(`/api/public/quiz/${id}/responder`, {
        method: "POST",
        body: JSON.stringify({
          equipaId,
          nomeMembro: nome.trim(),
          tempoMs,
          respostas: Object.entries(respostas).map(([perguntaId, opcaoId]) => ({
            perguntaId,
            opcaoId,
          })),
        }),
      });
      setResultado(r);
      setFase("fim");
    } catch (e) {
      setErro((e as Error).message);
      setFase("fim");
    } finally {
      setEnviando(false);
    }
  }, [quiz, enviando, id, equipaId, nome, respostas]);

  function comecar() {
    if (!equipaId || !nome.trim()) return;
    setRespostas({});
    setIdx(0);
    inicioRef.current = Date.now();
    setFase("quiz");
  }

  function escolher(perguntaId: string, opcaoId: string) {
    setRespostas((r) => ({ ...r, [perguntaId]: opcaoId }));
  }

  const perguntas = quiz?.perguntas ?? [];
  const atual = perguntas[idx];
  const ultima = idx >= perguntas.length - 1;

  // -------------------------------------------------------------- estados

  if (loading) {
    return (
      <Centro>
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </Centro>
    );
  }

  if (erro && !quiz) {
    return (
      <Centro>
        <p className="text-center text-lg font-semibold text-slate-700">{erro}</p>
      </Centro>
    );
  }

  if (quiz && !quiz.aberto && fase === "intro") {
    return (
      <Centro>
        <Clock className="h-12 w-12 text-slate-300" />
        <h1 className="text-xl font-bold text-navy">{quiz.nome}</h1>
        <p className="text-center text-slate-500">
          O questionário ainda não está aberto. Aguarda a indicação do
          organizador e volta a ler o QR Code.
        </p>
        <button
          onClick={carregar}
          className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white transition hover:bg-brand-700"
        >
          Tentar de novo
        </button>
      </Centro>
    );
  }

  // ------------------------------------------------------------------ fim

  if (fase === "fim") {
    return (
      <Centro>
        {resultado ? (
          <>
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-50">
              <Trophy className="h-10 w-10 text-brand-600" />
            </div>
            <h1 className="text-2xl font-black text-navy">Resposta registada!</h1>
            <p className="text-slate-500">
              {resultado.certas} de {resultado.totalPerguntas} certas
            </p>
            <div className="rounded-2xl bg-navy px-8 py-5 text-center text-white">
              <p className="text-xs uppercase tracking-widest text-brand-200">
                Pontos ganhos
              </p>
              <p className="text-4xl font-black">{nf(resultado.pontos)}</p>
            </div>
            <p className="text-center text-sm text-slate-400">
              Obrigado, {nome.trim()}! Os teus pontos foram somados à equipa.
            </p>
          </>
        ) : (
          <>
            <p className="text-center text-lg font-semibold text-slate-700">
              {erro ?? "Não foi possível registar a tua resposta."}
            </p>
            <button
              onClick={() => {
                setErro(null);
                setFase("intro");
              }}
              className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white transition hover:bg-brand-700"
            >
              Voltar
            </button>
          </>
        )}
      </Centro>
    );
  }

  // --------------------------------------------------------------- intro

  if (fase === "intro") {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-8">
        <div className="mb-6 text-center">
          {quiz?.evento?.nome && (
            <p className="text-xs font-semibold uppercase tracking-widest text-brand-500">
              {quiz.evento.nome}
            </p>
          )}
          <h1 className="mt-1 text-2xl font-black text-navy">{quiz?.nome}</h1>
          {quiz?.descricao && (
            <p className="mt-1 text-sm text-slate-500">{quiz.descricao}</p>
          )}
        </div>

        <label className="mb-1 block text-sm font-semibold text-slate-700">
          A tua equipa
        </label>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {equipas.map((eq) => {
            const sel = eq.id === equipaId;
            return (
              <button
                key={eq.id}
                onClick={() => setEquipaId(eq.id)}
                className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-left text-sm font-semibold transition ${
                  sel
                    ? "border-transparent text-white shadow"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
                style={sel ? { background: eq.cor } : undefined}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ background: sel ? "rgba(255,255,255,.9)" : eq.cor }}
                />
                <span className="truncate">{eq.nome}</span>
              </button>
            );
          })}
        </div>
        {equipas.length === 0 && (
          <p className="mb-4 text-sm text-slate-400">
            Ainda não há equipas neste evento.
          </p>
        )}

        <label className="mb-1 block text-sm font-semibold text-slate-700">
          O teu nome
        </label>
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Ex.: Maria João"
          className="mb-6 h-12 rounded-xl border border-slate-200 px-4 text-base outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />

        <div className="mt-auto">
          {quiz?.tempoLimiteSeg ? (
            <p className="mb-3 flex items-center justify-center gap-1.5 text-sm text-slate-500">
              <Clock className="h-4 w-4" /> Tens {quiz.tempoLimiteSeg}s — quanto
              mais rápido e certo, mais pontos!
            </p>
          ) : (
            <p className="mb-3 text-center text-sm text-slate-500">
              {perguntas.length} pergunta{perguntas.length === 1 ? "" : "s"}
            </p>
          )}
          <button
            onClick={comecar}
            disabled={!equipaId || !nome.trim() || perguntas.length === 0}
            className="h-12 w-full rounded-xl bg-brand-600 text-base font-bold text-white transition hover:bg-brand-700 disabled:opacity-40"
          >
            Começar
          </button>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- quiz

  return (
    <QuizCorrida
      quiz={quiz!}
      atual={atual}
      idx={idx}
      total={perguntas.length}
      escolhida={atual ? respostas[atual.id] : undefined}
      inicioRef={inicioRef}
      enviando={enviando}
      ultima={ultima}
      onEscolher={escolher}
      onAvancar={() => setIdx((i) => i + 1)}
      onSubmeter={submeter}
      onTempoEsgotado={submeter}
    />
  );
}

/* ============================ Ecrã da corrida =========================== */

function QuizCorrida({
  quiz,
  atual,
  idx,
  total,
  escolhida,
  inicioRef,
  enviando,
  ultima,
  onEscolher,
  onAvancar,
  onSubmeter,
  onTempoEsgotado,
}: {
  quiz: Quiz;
  atual: Pergunta | undefined;
  idx: number;
  total: number;
  escolhida: string | undefined;
  inicioRef: React.MutableRefObject<number>;
  enviando: boolean;
  ultima: boolean;
  onEscolher: (perguntaId: string, opcaoId: string) => void;
  onAvancar: () => void;
  onSubmeter: () => void;
  onTempoEsgotado: () => void;
}) {
  const limite = quiz.tempoLimiteSeg ?? 0;
  const [restante, setRestante] = useState(limite);
  const esgotouRef = useRef(false);

  useEffect(() => {
    if (!limite) return;
    const t = setInterval(() => {
      const passou = (Date.now() - inicioRef.current) / 1000;
      const r = Math.max(0, limite - passou);
      setRestante(r);
      if (r <= 0 && !esgotouRef.current) {
        esgotouRef.current = true;
        clearInterval(t);
        onTempoEsgotado();
      }
    }, 200);
    return () => clearInterval(t);
  }, [limite, inicioRef, onTempoEsgotado]);

  const pct = useMemo(
    () => (total ? ((idx + 1) / total) * 100 : 0),
    [idx, total]
  );

  if (!atual) return null;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-6">
      {/* topo: progresso + tempo */}
      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-500">
          <span>
            Pergunta {idx + 1}/{total}
          </span>
          {limite > 0 && (
            <span
              className={`flex items-center gap-1 tabular-nums ${
                restante <= 5 ? "text-red-500" : "text-slate-500"
              }`}
            >
              <Clock className="h-4 w-4" />
              {Math.ceil(restante)}s
            </span>
          )}
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-brand-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <h2 className="mb-5 text-xl font-bold text-navy">{atual.enunciado}</h2>

      <div className="space-y-3">
        {atual.opcoes.map((o) => {
          const sel = escolhida === o.id;
          return (
            <button
              key={o.id}
              onClick={() => onEscolher(atual.id, o.id)}
              className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-4 text-left text-base font-medium transition ${
                sel
                  ? "border-brand-500 bg-brand-50 text-navy"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                  sel ? "border-brand-500 bg-brand-500 text-white" : "border-slate-300"
                }`}
              >
                {sel && <CheckCircle2 className="h-5 w-5" />}
              </span>
              <span>{o.texto}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-auto pt-6">
        {ultima ? (
          <button
            onClick={onSubmeter}
            disabled={enviando}
            className="h-12 w-full rounded-xl bg-navy text-base font-bold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {enviando ? "A enviar…" : "Terminar e enviar"}
          </button>
        ) : (
          <button
            onClick={onAvancar}
            className="h-12 w-full rounded-xl bg-brand-600 text-base font-bold text-white transition hover:bg-brand-700"
          >
            Próxima
          </button>
        )}
      </div>
    </div>
  );
}

function Centro({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full flex-col items-center justify-center gap-4 px-6">
      {children}
    </div>
  );
}
