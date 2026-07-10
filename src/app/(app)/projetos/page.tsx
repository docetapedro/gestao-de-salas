"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

type Projeto = {
  id: string;
  nome: string;
  areaTematica: string | null;
  cliente: { nome: string } | null;
  modalidade: string | null;
  dataInicio: string | null;
  pilar: { nome: string } | null;
  local: { name: string } | null;
  _count: { participantes: number };
};

export default function ProjetosPage() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ projetos: Projeto[] }>("/api/projetos")
      .then((d) => setProjetos(d.projetos))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Projectos</h1>
          <p className="text-sm text-slate-500">
            Formações e o respectivo relatório One-Page de indicadores.
          </p>
        </div>
        <Link
          href="/projetos/novo"
          className="rounded-lg bg-navy text-white px-4 py-2 text-sm font-semibold hover:bg-navy-light"
        >
          + Novo projecto
        </Link>
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-200">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Carregando…</div>
        ) : projetos.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            Nenhum projecto ainda.{" "}
            <Link href="/projetos/novo" className="text-brand-600 hover:underline">
              Criar o primeiro
            </Link>
            .
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Formação</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Modalidade</th>
                <th className="px-4 py-3 font-medium">Inscritos</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {projetos.map((p) => (
                <tr key={p.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/projetos/${p.id}`}
                      className="font-medium text-slate-800 hover:text-brand-700"
                    >
                      {p.nome}
                    </Link>
                    <div className="text-xs text-slate-400">
                      {p.areaTematica || p.pilar?.nome || "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.cliente?.nome || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{p.modalidade || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{p._count.participantes}</td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <Link
                      href={`/projetos/${p.id}`}
                      className="text-brand-600 hover:underline mr-3"
                    >
                      Relatório
                    </Link>
                    <Link
                      href={`/projetos/${p.id}/editar`}
                      className="text-slate-600 hover:underline"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
