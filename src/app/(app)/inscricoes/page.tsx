"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FileDown, Search, Trash2, Users } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/Modal";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado");

type Inscricao = {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  tema: string;
  createdAt: string;
};

function fmtDataHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export default function InscricoesPage() {
  const [inscricoes, setInscricoes] = useState<Inscricao[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [del, setDel] = useState<Inscricao | null>(null);
  const [busyDel, setBusyDel] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const sp = new URLSearchParams();
      if (q.trim()) sp.set("q", q.trim());
      const { inscricoes } = await api<{ inscricoes: Inscricao[] }>(
        `/api/inscricoes?${sp.toString()}`
      );
      setInscricoes(inscricoes);
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setLoading(false);
    }
  }, [q]);

  // Debounce da pesquisa.
  useEffect(() => {
    const t = setTimeout(carregar, 250);
    return () => clearTimeout(t);
  }, [carregar]);

  async function excluir() {
    if (!del) return;
    setBusyDel(true);
    try {
      await api(`/api/inscricoes/${del.id}`, { method: "DELETE" });
      toast.success("Inscrição removida");
      setDel(null);
      carregar();
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setBusyDel(false);
    }
  }

  function exportarCsv() {
    if (inscricoes.length === 0) {
      toast.error("Não há inscrições para exportar");
      return;
    }
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const linhas = [
      ["Nome", "Email", "Telefone", "Tema", "Data de inscrição"].join(";"),
      ...inscricoes.map((i) =>
        [i.nome, i.email, i.telefone, i.tema, fmtDataHora(i.createdAt)]
          .map(esc)
          .join(";")
      ),
    ];
    // BOM para o Excel reconhecer acentos (UTF-8).
    const blob = new Blob(["﻿" + linhas.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inscricoes-workshop.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const total = useMemo(() => inscricoes.length, [inscricoes]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-navy">Inscrições — Workshop</h1>
          <p className="text-sm text-slate-500">
            Inteligência Artificial no Mundo Corporativo ·{" "}
            <span className="font-semibold text-navy">{total}</span>{" "}
            {total === 1 ? "inscrito" : "inscritos"}
          </p>
        </div>
        <Button variant="outline" onClick={exportarCsv} className="gap-2">
          <FileDown className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pesquisar por nome, email ou telefone…"
          className="pl-9"
        />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-6 text-sm text-slate-500">A carregar…</p>
          ) : inscricoes.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <Users className="h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">
                {q.trim()
                  ? "Nenhuma inscrição corresponde à pesquisa."
                  : "Ainda não há inscrições."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-3 font-semibold">Nome</th>
                    <th className="px-4 py-3 font-semibold">Email</th>
                    <th className="px-4 py-3 font-semibold">Telefone</th>
                    <th className="px-4 py-3 font-semibold">Inscrito em</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {inscricoes.map((i) => (
                    <tr key={i.id} className="border-b last:border-0 hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-medium text-navy">{i.nome}</td>
                      <td className="px-4 py-3 text-slate-600">{i.email}</td>
                      <td className="px-4 py-3 text-slate-600">{i.telefone}</td>
                      <td className="px-4 py-3 text-slate-500">{fmtDataHora(i.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDel(i)}
                          title="Remover inscrição"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {del && (
        <ConfirmDialog
          title="Remover inscrição"
          danger
          busy={busyDel}
          confirmLabel="Remover"
          message={
            <>
              Remover a inscrição de <b>{del.nome}</b> ({del.email})?
            </>
          }
          onConfirm={excluir}
          onCancel={() => setDel(null)}
        />
      )}
    </div>
  );
}
