"use client";

import { use, useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CheckCircle2, Clock, Loader2, Megaphone } from "lucide-react";

type Equipa = { id: string; nome: string; cor: string; lema: string | null };
type Grito = {
  id: string;
  nome: string;
  descricao: string | null;
  aberto: boolean;
  evento: { nome: string; local: string | null } | null;
};

type Fase = "escolha" | "fim";

export default function GritoPublicoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [grito, setGrito] = useState<Grito | null>(null);
  const [equipas, setEquipas] = useState<Equipa[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [fase, setFase] = useState<Fase>("escolha");
  const [minhaEquipaId, setMinhaEquipaId] = useState("");
  const [votadaId, setVotadaId] = useState("");
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    try {
      const d = await api<{ grito: Grito; equipas: Equipa[] }>(
        `/api/public/grito/${id}`
      );
      setGrito(d.grito);
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

  const votar = useCallback(async () => {
    if (!minhaEquipaId || !votadaId || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await api(`/api/public/grito/${id}/votar`, {
        method: "POST",
        body: JSON.stringify({
          votanteEquipaId: minhaEquipaId,
          votadaEquipaId: votadaId,
        }),
      });
      setFase("fim");
    } catch (e) {
      setErro((e as Error).message);
      setFase("fim");
    } finally {
      setEnviando(false);
    }
  }, [minhaEquipaId, votadaId, enviando, id]);

  // ----------------------------------------------------------- estados base

  if (loading) {
    return (
      <Centro>
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </Centro>
    );
  }

  if (erro && !grito) {
    return (
      <Centro>
        <p className="text-center text-lg font-semibold text-slate-700">{erro}</p>
      </Centro>
    );
  }

  if (grito && !grito.aberto && fase === "escolha") {
    return (
      <Centro>
        <Clock className="h-12 w-12 text-slate-300" />
        <h1 className="text-xl font-bold text-navy">{grito.nome}</h1>
        <p className="text-center text-slate-500">
          A votação ainda não está aberta. Aguarda a indicação do organizador e
          volta a ler o QR Code.
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

  // ------------------------------------------------------------------- fim

  if (fase === "fim") {
    return (
      <Centro>
        {erro ? (
          <>
            <p className="text-center text-lg font-semibold text-slate-700">
              {erro}
            </p>
            <button
              onClick={() => {
                setErro(null);
                setFase("escolha");
              }}
              className="rounded-lg bg-brand-600 px-4 py-2 font-semibold text-white transition hover:bg-brand-700"
            >
              Voltar
            </button>
          </>
        ) : (
          <>
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand-50">
              <CheckCircle2 className="h-10 w-10 text-brand-600" />
            </div>
            <h1 className="text-2xl font-black text-navy">Voto registado!</h1>
            <p className="text-center text-slate-500">
              Obrigado. O teu grupo já votou — o vencedor é anunciado pelo
              organizador.
            </p>
          </>
        )}
      </Centro>
    );
  }

  // --------------------------------------------------------------- escolha

  const outras = equipas.filter((e) => e.id !== minhaEquipaId);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-5 py-8">
      <div className="mb-6 text-center">
        {grito?.evento?.nome && (
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-500">
            {grito.evento.nome}
          </p>
        )}
        <div className="mt-1 flex items-center justify-center gap-2">
          <Megaphone className="h-6 w-6 text-brand-600" />
          <h1 className="text-2xl font-black text-navy">{grito?.nome}</h1>
        </div>
        {grito?.descricao && (
          <p className="mt-1 text-sm text-slate-500">{grito.descricao}</p>
        )}
      </div>

      {/* 1. O meu grupo */}
      <label className="mb-1 block text-sm font-semibold text-slate-700">
        O teu grupo
      </label>
      <p className="mb-2 text-xs text-slate-400">
        Só um voto por grupo — o primeiro a votar decide pelo grupo.
      </p>
      <div className="mb-5 grid grid-cols-2 gap-2">
        {equipas.map((eq) => {
          const sel = eq.id === minhaEquipaId;
          return (
            <button
              key={eq.id}
              onClick={() => {
                setMinhaEquipaId(eq.id);
                if (votadaId === eq.id) setVotadaId("");
              }}
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
          Ainda não há grupos neste evento.
        </p>
      )}

      {/* 2. Grupo a votar (exclui o próprio) */}
      {minhaEquipaId && (
        <>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Vota no melhor grito de guerra
          </label>
          {outras.length === 0 ? (
            <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Não há outros grupos para votar.
            </p>
          ) : (
            <div className="mb-6 space-y-2">
              {outras.map((eq) => {
                const sel = eq.id === votadaId;
                return (
                  <button
                    key={eq.id}
                    onClick={() => setVotadaId(eq.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left text-base font-medium transition ${
                      sel
                        ? "border-brand-500 bg-brand-50 text-navy"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <span
                      className="h-4 w-4 shrink-0 rounded-full"
                      style={{ background: eq.cor }}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{eq.nome}</span>
                      {eq.lema && (
                        <span className="block truncate text-xs italic text-slate-400">
                          “{eq.lema}”
                        </span>
                      )}
                    </span>
                    {sel && (
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-brand-500" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}

      <div className="mt-auto">
        <button
          onClick={votar}
          disabled={!minhaEquipaId || !votadaId || enviando}
          className="h-12 w-full rounded-xl bg-brand-600 text-base font-bold text-white transition hover:bg-brand-700 disabled:opacity-40"
        >
          {enviando ? "A registar…" : "Votar"}
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
