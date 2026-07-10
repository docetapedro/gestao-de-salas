"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import ProjectForm, { type ProjectInitial } from "@/components/ProjectForm";

export default function EditarProjetoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [projeto, setProjeto] = useState<ProjectInitial | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ projeto: ProjectInitial }>(`/api/projetos/${id}`)
      .then((d) => setProjeto(d.projeto))
      .catch((e) => setError((e as Error).message));
  }, [id]);

  return (
    <div>
      <div className="mb-4">
        <Link href={`/projetos/${id}`} className="text-sm text-brand-600 hover:underline">
          ← Voltar ao relatório
        </Link>
        <h1 className="text-2xl font-bold text-navy mt-1">Editar projecto</h1>
      </div>
      {error && (
        <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-200">
          {error}
        </div>
      )}
      {projeto ? (
        <ProjectForm initial={projeto} />
      ) : (
        !error && <div className="text-slate-400">Carregando…</div>
      )}
    </div>
  );
}
