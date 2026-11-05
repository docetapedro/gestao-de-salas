"use client";

import { use, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { CalendarDays, CheckCircle2, Loader2, MapPin } from "lucide-react";

type Evento = {
  tipo: string;
  titulo: string;
  descricao: string | null;
  local: string | null;
  dataInicio: string | null;
  ativo: boolean;
};

const inputCls =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm text-navy outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

function fmtDataHora(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("pt-PT", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function InscricaoPublicaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);

  const [evento, setEvento] = useState<Evento | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [naoEncontrado, setNaoEncontrado] = useState(false);

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [feito, setFeito] = useState(false);

  useEffect(() => {
    api<{ evento: Evento }>(`/api/public/inscricoes/${slug}`)
      .then((d) => setEvento(d.evento))
      .catch(() => setNaoEncontrado(true))
      .finally(() => setCarregando(false));
  }, [slug]);

  async function submeter(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setErro(null);
    if (!nome.trim()) return setErro("Indique o seu nome.");
    if (!email.trim()) return setErro("Indique o seu email.");
    if (!telefone.trim()) return setErro("Indique o seu telefone.");

    setEnviando(true);
    try {
      await api(`/api/public/inscricoes/${slug}`, {
        method: "POST",
        body: JSON.stringify({ nome, email, telefone }),
      });
      setFeito(true);
    } catch (err) {
      setErro(err instanceof Error ? err.message : "Não foi possível concluir a inscrição.");
    } finally {
      setEnviando(false);
    }
  }

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (naoEncontrado || !evento) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
          <h1 className="text-xl font-black text-navy">Evento não encontrado</h1>
          <p className="mt-2 text-sm text-slate-500">
            O link de inscrição é inválido ou o evento já não está disponível.
          </p>
        </div>
      </div>
    );
  }

  const dataFmt = fmtDataHora(evento.dataInicio);

  if (feito) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-100">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-brand-50">
            <CheckCircle2 className="h-10 w-10 text-brand-600" />
          </div>
          <h1 className="mt-5 text-2xl font-black text-navy">Inscrição registada!</h1>
          <p className="mt-2 text-sm text-slate-500">
            Obrigado, <span className="font-semibold text-navy">{nome.trim()}</span>. A sua
            inscrição em <span className="font-semibold text-navy">{evento.titulo}</span> foi
            confirmada. Entraremos em contacto por email.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-500">
            {evento.tipo}
          </p>
          <h1 className="mt-1 text-2xl font-black leading-tight text-navy">{evento.titulo}</h1>
          {evento.descricao && (
            <p className="mt-2 text-sm text-slate-500">{evento.descricao}</p>
          )}
          <div className="mt-3 flex flex-col items-center gap-1 text-sm text-slate-500">
            {dataFmt && (
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4 text-brand-500" />
                {dataFmt}
              </span>
            )}
            {evento.local && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-brand-500" />
                {evento.local}
              </span>
            )}
          </div>
        </div>

        {!evento.ativo ? (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-100">
            <p className="text-sm font-semibold text-amber-700">
              As inscrições para este evento estão encerradas.
            </p>
          </div>
        ) : (
          <form
            onSubmit={submeter}
            className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-100"
          >
            <div className="mb-4">
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Nome <span className="text-red-500">*</span>
              </label>
              <input
                className={inputCls}
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="O seu nome completo"
                autoComplete="name"
                required
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Email <span className="text-red-500">*</span>
              </label>
              <input
                className={inputCls}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@exemplo.com"
                autoComplete="email"
                inputMode="email"
                required
              />
            </div>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Telefone <span className="text-red-500">*</span>
              </label>
              <input
                className={inputCls}
                type="tel"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="+244 900 000 000"
                autoComplete="tel"
                inputMode="tel"
                required
              />
            </div>

            {erro && (
              <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>
            )}

            <button
              type="submit"
              disabled={enviando}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-base font-bold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {enviando && <Loader2 className="h-5 w-5 animate-spin" />}
              {enviando ? "A inscrever…" : "Inscrever-me"}
            </button>

            <p className="mt-3 text-center text-xs text-slate-400">
              Cada email e telefone só pode ser inscrito uma vez neste evento.
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
