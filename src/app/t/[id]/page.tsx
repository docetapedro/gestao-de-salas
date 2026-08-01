"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import {
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  PartyPopper,
  Trophy,
} from "lucide-react";

type Equipa = { id: string; nome: string; cor: string };
type BlocoMeta = { tamanho: number; etiqueta: string | null };
type Tesouro = {
  id: string;
  nome: string;
  descricao: string | null;
  evento: { nome: string; local: string | null } | null;
  aberto: boolean;
  vencedor: { id: string; nome: string; cor: string } | null;
  blocos: BlocoMeta[];
};

type Resposta = {
  correta: boolean;
  venceu: boolean;
  jaAberto: boolean;
  vencedorNome: string | null;
};

export default function TesouroPublicoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [tesouro, setTesouro] = useState<Tesouro | null>(null);
  const [equipas, setEquipas] = useState<Equipa[]>([]);
  const [loading, setLoading] = useState(true);
  const [erroInicial, setErroInicial] = useState<string | null>(null);

  const [equipaId, setEquipaId] = useState("");
  const [valores, setValores] = useState<string[]>([]);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);
  const [enviando, setEnviando] = useState(false);
  const [feedback, setFeedback] = useState<Resposta | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    try {
      const d = await api<{ tesouro: Tesouro; equipas: Equipa[] }>(
        `/api/public/tesouro/${id}`
      );
      setTesouro(d.tesouro);
      setEquipas(d.equipas);
      setValores(d.tesouro.blocos.map(() => ""));
    } catch (e) {
      setErroInicial((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const blocos = tesouro?.blocos ?? [];
  const todosPreenchidos =
    blocos.length > 0 &&
    blocos.every((b, i) => (valores[i] ?? "").length === b.tamanho);

  function setBloco(i: number, v: string) {
    const b = blocos[i];
    const nv = v
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, b.tamanho);
    setValores((vals) => vals.map((x, idx) => (idx === i ? nv : x)));
    setErro(null);
    if (nv.length === b.tamanho) inputsRef.current[i + 1]?.focus();
  }

  const tentar = useCallback(async () => {
    if (!equipaId || !todosPreenchidos || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      const r = await api<Resposta>(`/api/public/tesouro/${id}/abrir`, {
        method: "POST",
        body: JSON.stringify({ equipaId, combinacao: valores.join("") }),
      });
      if (r.correta) {
        setFeedback(r); // venceu ou já estava aberto
      } else {
        setErro("Chave incorreta — combinem outra e tentem de novo!");
        setValores(blocos.map(() => ""));
        setTimeout(() => inputsRef.current[0]?.focus(), 60);
      }
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setEnviando(false);
    }
  }, [equipaId, todosPreenchidos, enviando, id, valores, blocos]);

  // ----------------------------------------------------------- estados base

  if (loading)
    return (
      <Centro>
        <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
      </Centro>
    );

  if (erroInicial && !tesouro)
    return (
      <Centro>
        <p className="text-center text-lg font-semibold text-slate-700">
          {erroInicial}
        </p>
      </Centro>
    );

  // Resultado da tentativa (venceu / já aberto).
  if (feedback) {
    return (
      <Centro>
        {feedback.venceu ? (
          <>
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-amber-100">
              <PartyPopper className="h-10 w-10 text-amber-600" />
            </div>
            <h1 className="text-2xl font-black text-navy">Abriram o baú! 🎉</h1>
            <p className="text-center text-slate-500">
              O vosso grupo foi o primeiro a desbloquear o tesouro. Olhem para o
              ecrã principal!
            </p>
          </>
        ) : (
          <>
            <Trophy className="h-12 w-12 text-slate-300" />
            <h1 className="text-xl font-bold text-navy">Baú já aberto</h1>
            <p className="text-center text-slate-500">
              {feedback.vencedorNome
                ? `A vossa chave estava certa, mas o grupo "${feedback.vencedorNome}" chegou primeiro.`
                : "O baú já tinha sido aberto por outro grupo."}
            </p>
          </>
        )}
      </Centro>
    );
  }

  // Baú já aberto quando abriram a página.
  if (tesouro && tesouro.aberto) {
    return (
      <Centro>
        <Trophy className="h-12 w-12 text-amber-400" />
        <h1 className="text-xl font-bold text-navy">{tesouro.nome}</h1>
        <p className="text-center text-slate-500">
          Este baú já foi aberto
          {tesouro.vencedor ? ` pelo grupo "${tesouro.vencedor.nome}"` : ""}.
        </p>
        <button
          onClick={carregar}
          className="rounded-lg bg-amber-500 px-4 py-2 font-semibold text-white transition hover:bg-amber-600"
        >
          Atualizar
        </button>
      </Centro>
    );
  }

  // --------------------------------------------------------------- jogar

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-8">
      <div className="mb-6 text-center">
        {tesouro?.evento?.nome && (
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-500">
            {tesouro.evento.nome}
          </p>
        )}
        <div className="mt-1 flex items-center justify-center gap-2">
          <Lock className="h-6 w-6 text-amber-600" />
          <h1 className="text-2xl font-black text-navy">{tesouro?.nome}</h1>
        </div>
        {tesouro?.descricao && (
          <p className="mt-1 text-sm text-slate-500">{tesouro.descricao}</p>
        )}
      </div>

      {/* 1. Grupo */}
      <label className="mb-1 block text-sm font-semibold text-slate-700">
        O teu grupo
      </label>
      <div className="mb-5 grid grid-cols-2 gap-2">
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

      {/* 2. Chave */}
      {equipaId && (
        <>
          <label className="mb-1 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <KeyRound className="h-4 w-4 text-amber-600" /> A combinação que
            descobriram
          </label>
          {blocos.length === 0 ? (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Este baú ainda não tem blocos definidos.
            </p>
          ) : (
            <div className="mb-3 flex flex-wrap items-start gap-2">
              {blocos.map((b, i) => (
                <div key={i} className="flex flex-col items-center gap-1">
                  <input
                    ref={(el) => {
                      inputsRef.current[i] = el;
                    }}
                    value={valores[i] ?? ""}
                    onChange={(e) => setBloco(i, e.target.value)}
                    onKeyDown={(e) => {
                      if (
                        e.key === "Backspace" &&
                        !(valores[i] ?? "") &&
                        i > 0
                      ) {
                        inputsRef.current[i - 1]?.focus();
                      }
                    }}
                    maxLength={b.tamanho}
                    inputMode="text"
                    autoComplete="off"
                    spellCheck={false}
                    aria-label={`Bloco ${i + 1}`}
                    className="h-12 rounded-xl border-2 border-amber-200 bg-white text-center text-xl font-bold uppercase text-navy outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                    style={{ width: `${Math.max(3, b.tamanho + 1.5)}ch` }}
                  />
                  {b.etiqueta && (
                    <span className="max-w-[5rem] truncate text-[10px] uppercase tracking-wide text-slate-400">
                      {b.etiqueta}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          {erro && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
              {erro}
            </p>
          )}
        </>
      )}

      <div className="mt-auto">
        <button
          onClick={tentar}
          disabled={!equipaId || !todosPreenchidos || enviando}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 text-base font-bold text-white transition hover:bg-amber-600 disabled:opacity-40"
        >
          {enviando ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <CheckCircle2 className="h-5 w-5" />
          )}
          {enviando ? "A tentar…" : "Tentar abrir o baú"}
        </button>
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
