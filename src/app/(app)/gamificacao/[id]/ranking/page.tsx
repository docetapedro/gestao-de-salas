"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Crown, Maximize, Minimize, RefreshCw, Trophy, X } from "lucide-react";

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
type Evento = { id: string; nome: string; local: string | null };

const POLL_MS = 4000;

function nf(n: number) {
  return new Intl.NumberFormat("pt-PT", { maximumFractionDigits: 2 }).format(n);
}

// Anima a contagem de um número quando o valor alvo muda.
function useCountUp(target: number, ms = 700) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    if (from === target) return;
    startRef.current = null;
    const step = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(from + (target - from) * eased);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(step);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = target;
    };
  }, [target, ms]);

  return value;
}

function Pontos({ total }: { total: number }) {
  const v = useCountUp(total);
  return <>{nf(Math.round(v * 100) / 100)}</>;
}

export default function RankingProjecaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [evento, setEvento] = useState<Evento | null>(null);
  const [ranking, setRanking] = useState<LinhaRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [fs, setFs] = useState(false);
  const [pulse, setPulse] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const d = await api<{ evento: Evento; ranking: LinhaRanking[] }>(
        `/api/gamificacao/eventos/${id}`
      );
      setEvento(d.evento);
      setRanking(d.ranking);
      setPulse(true);
      setTimeout(() => setPulse(false), 600);
    } catch {
      /* mantém o último estado em caso de falha momentânea */
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    carregar();
    const t = setInterval(carregar, POLL_MS);
    return () => clearInterval(t);
  }, [carregar]);

  useEffect(() => {
    const onFs = () => setFs(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  async function toggleFs() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      /* alguns browsers bloqueiam sem gesto — ignora */
    }
  }

  const top3 = ranking.slice(0, 3);
  const resto = ranking.slice(3);
  // Ordem visual do pódio: 2º, 1º, 3º.
  const podio = [top3[1], top3[0], top3[2]].filter(Boolean) as LinhaRanking[];
  const alturas: Record<number, string> = { 1: "h-52", 2: "h-40", 3: "h-32" };
  const maxResto = Math.max(1, ...resto.map((r) => r.total));

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-[#050b1f] text-white">
      <style>{`
        @keyframes glowpulse {0%,100%{opacity:.35;transform:scale(1)}50%{opacity:.7;transform:scale(1.08)}}
        @keyframes floaty {0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes rise {from{transform:translateY(40px);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes shimmer {0%{background-position:-200% 0}100%{background-position:200% 0}}
      `}</style>

      {/* brilhos de fundo */}
      <div
        className="pointer-events-none absolute -left-40 -top-40 h-[36rem] w-[36rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle,#1d4ed8,transparent 70%)", animation: "glowpulse 6s ease-in-out infinite" }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-40 h-[36rem] w-[36rem] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle,#7c3aed,transparent 70%)", animation: "glowpulse 7s ease-in-out infinite" }}
      />

      {/* controlos */}
      <div className="absolute right-4 top-4 z-20 flex gap-2">
        <button
          onClick={carregar}
          title="Actualizar"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur transition hover:bg-white/20"
        >
          <RefreshCw className={`h-5 w-5 ${pulse ? "animate-spin" : ""}`} />
        </button>
        <button
          onClick={toggleFs}
          title="Ecrã cheio"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur transition hover:bg-white/20"
        >
          {fs ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
        </button>
        <button
          onClick={() => router.push(`/gamificacao/${id}`)}
          title="Fechar"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur transition hover:bg-white/20"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative z-10 flex h-full flex-col px-6 py-6 sm:px-10">
        {/* cabeçalho */}
        <div className="mb-2 text-center">
          <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1 text-xs font-medium uppercase tracking-widest text-brand-100">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
            </span>
            Ranking ao vivo
          </div>
          <h1 className="bg-gradient-to-r from-white via-brand-100 to-white bg-clip-text text-3xl font-black tracking-tight text-transparent sm:text-5xl">
            {evento?.nome ?? "Team Building"}
          </h1>
          {evento?.local && (
            <p className="mt-1 text-sm text-brand-200/80">{evento.local}</p>
          )}
        </div>

        {loading && ranking.length === 0 ? (
          <div className="flex flex-1 items-center justify-center text-brand-200">
            A carregar…
          </div>
        ) : ranking.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 text-brand-200">
            <Trophy className="h-16 w-16 opacity-40" />
            <p>Sem equipas neste evento.</p>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col justify-center gap-6">
            {/* PÓDIO */}
            <div className="flex items-end justify-center gap-3 sm:gap-6">
              {podio.map((r) => {
                const first = r.posicao === 1;
                return (
                  <div
                    key={r.equipaId}
                    className="flex w-28 flex-col items-center sm:w-44"
                    style={{ animation: "rise .5s ease-out both" }}
                  >
                    {/* avatar */}
                    <div className="relative mb-2" style={first ? { animation: "floaty 3s ease-in-out infinite" } : undefined}>
                      {first && (
                        <Crown className="absolute -top-7 left-1/2 h-8 w-8 -translate-x-1/2 text-amber-300 drop-shadow" />
                      )}
                      <div
                        className="flex items-center justify-center rounded-full font-black text-white shadow-xl"
                        style={{
                          background: r.cor,
                          width: first ? 92 : 68,
                          height: first ? 92 : 68,
                          fontSize: first ? 30 : 22,
                          boxShadow: `0 0 0 4px rgba(255,255,255,.15), 0 0 40px ${r.cor}`,
                        }}
                      >
                        {r.nome.slice(0, 2).toUpperCase()}
                      </div>
                    </div>
                    <p className="max-w-full truncate text-center text-sm font-bold sm:text-lg">
                      {r.nome}
                    </p>
                    <p
                      className="mb-1 text-2xl font-black sm:text-4xl"
                      style={{ color: r.cor === "#050b1f" ? "#fff" : undefined }}
                    >
                      <Pontos total={r.total} />
                    </p>
                    {/* pedestal */}
                    <div
                      className={`${alturas[r.posicao] ?? "h-32"} flex w-full items-start justify-center rounded-t-xl pt-3`}
                      style={{
                        background: `linear-gradient(180deg, ${r.cor}55, ${r.cor}18)`,
                        borderTop: `3px solid ${r.cor}`,
                      }}
                    >
                      <span
                        className="text-5xl font-black sm:text-7xl"
                        style={{
                          color: "#fff",
                          textShadow: "0 2px 20px rgba(0,0,0,.4)",
                        }}
                      >
                        {r.posicao}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* RESTANTES */}
            {resto.length > 0 && (
              <div className="mx-auto w-full max-w-3xl space-y-2 overflow-y-auto">
                {resto.map((r) => (
                  <div
                    key={r.equipaId}
                    className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-2.5 backdrop-blur"
                  >
                    <span className="w-8 text-center text-lg font-bold text-brand-200">
                      {r.posicao}º
                    </span>
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                      style={{ background: r.cor }}
                    >
                      {r.nome.slice(0, 2).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="truncate font-semibold">{r.nome}</span>
                        <span className="shrink-0 text-lg font-black">
                          <Pontos total={r.total} />
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${(r.total / maxResto) * 100}%`,
                            background: r.cor,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
