import { Suspense } from "react";
import Link from "next/link";
import PlanoTrimestrePublico from "./PlanoTrimestrePublico";

export const metadata = {
  title: "Plano Formativo — Visão Trimestral",
  description: "Consulta pública da visão trimestral do plano formativo.",
};

// Página pública (sem sessão): mostra apenas a visão trimestral, em leitura.
export default function PlanoTrimestrePublicoPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/Logo.png"
          alt="Academia TIS"
          className="h-9 object-contain object-left"
        />
        <span className="text-sm font-semibold text-slate-700">
          Plano Formativo · Visão Trimestral
        </span>
        <Link
          href="/login"
          className="ml-auto rounded-lg bg-navy px-3 py-1.5 text-sm font-medium text-white transition hover:bg-navy/90"
        >
          Entrar
        </Link>
      </header>
      <main className="flex-1 overflow-x-hidden p-4 sm:p-6">
        <Suspense
          fallback={<div className="py-16 text-center text-slate-400">A carregar…</div>}
        >
          <PlanoTrimestrePublico />
        </Suspense>
      </main>
    </div>
  );
}
