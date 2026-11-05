"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  Copy,
  Download,
  FileDown,
  MapPin,
  QrCode as QrCodeIcon,
  Search,
  Trash2,
  Users,
} from "lucide-react";
import QRCodeLib from "qrcode";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/Modal";

const msg = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado");

type Inscrito = {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  createdAt: string;
};
type Evento = {
  id: string;
  tipo: string;
  titulo: string;
  descricao: string | null;
  local: string | null;
  dataInicio: string | null;
  slug: string;
  ativo: boolean;
  inscricoes: Inscrito[];
};

function fmtDataHora(iso: string | null): string {
  if (!iso) return "—";
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

export default function EventoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const [evento, setEvento] = useState<Evento | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [del, setDel] = useState<Inscrito | null>(null);
  const [busyDel, setBusyDel] = useState(false);

  const [mostrarQr, setMostrarQr] = useState(false);
  const [qr, setQr] = useState("");
  const [copiado, setCopiado] = useState(false);

  const origem = typeof window !== "undefined" ? window.location.origin : "";
  const link = evento ? `${origem}/inscricao/${evento.slug}` : "";

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const { evento } = await api<{ evento: Evento }>(`/api/inscricoes/eventos/${id}`);
      setEvento(evento);
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (!link) return;
    QRCodeLib.toDataURL(link, { width: 1024, margin: 1 })
      .then(setQr)
      .catch(() => setQr(""));
  }, [link]);

  const inscritos = useMemo(() => {
    const lista = evento?.inscricoes ?? [];
    const termo = q.trim().toLowerCase();
    if (!termo) return lista;
    return lista.filter(
      (i) =>
        i.nome.toLowerCase().includes(termo) ||
        i.email.toLowerCase().includes(termo) ||
        i.telefone.toLowerCase().includes(termo)
    );
  }, [evento, q]);

  async function excluir() {
    if (!del) return;
    setBusyDel(true);
    try {
      await api(`/api/inscricoes/inscritos/${del.id}`, { method: "DELETE" });
      toast.success("Inscrição removida");
      setDel(null);
      carregar();
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setBusyDel(false);
    }
  }

  function copiarLink() {
    navigator.clipboard?.writeText(link).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    });
  }

  function descarregarQr() {
    if (!qr || !evento) return;
    const a = document.createElement("a");
    a.href = qr;
    a.download = `qr-${evento.slug}.png`;
    a.click();
  }

  function exportarCsv() {
    const lista = evento?.inscricoes ?? [];
    if (lista.length === 0) {
      toast.error("Não há inscrições para exportar");
      return;
    }
    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const linhas = [
      ["Nome", "Email", "Telefone", "Data de inscrição"].join(";"),
      ...lista.map((i) =>
        [i.nome, i.email, i.telefone, fmtDataHora(i.createdAt)].map(esc).join(";")
      ),
    ];
    const blob = new Blob(["﻿" + linhas.join("\r\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `inscricoes-${evento?.slug || "evento"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return <p className="p-6 text-sm text-slate-500">A carregar…</p>;
  }
  if (!evento) {
    return (
      <div className="space-y-3">
        <Link href="/inscricoes" className="text-sm text-brand-600 hover:underline">
          ← Voltar
        </Link>
        <p className="text-sm text-slate-500">Evento não encontrado.</p>
      </div>
    );
  }

  const total = evento.inscricoes.length;

  return (
    <div className="space-y-4">
      <Link
        href="/inscricoes"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-navy"
      >
        <ArrowLeft className="h-4 w-4" />
        Voltar aos eventos
      </Link>

      {/* Cabeçalho do evento */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">
              {evento.tipo}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                evento.ativo
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-slate-100 text-slate-500"
              }`}
            >
              {evento.ativo ? "Inscrições abertas" : "Encerrado"}
            </span>
          </div>
          <h1 className="mt-1.5 text-xl font-bold text-navy">{evento.titulo}</h1>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" />
              {fmtDataHora(evento.dataInicio)}
            </span>
            {evento.local && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4" />
                {evento.local}
              </span>
            )}
            <span className="flex items-center gap-1.5 font-semibold text-navy">
              <Users className="h-4 w-4" />
              {total} {total === 1 ? "inscrito" : "inscritos"}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setMostrarQr((v) => !v)}
          >
            <QrCodeIcon className="h-4 w-4" />
            QR / Link
          </Button>
          <Button variant="outline" className="gap-2" onClick={exportarCsv}>
            <FileDown className="h-4 w-4" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {mostrarQr && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 p-6 sm:flex-row">
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr}
                alt="QR Code de inscrição"
                className="h-44 w-44 shrink-0 rounded-xl border border-slate-200"
              />
            ) : (
              <div className="flex h-44 w-44 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-300">
                <QrCodeIcon className="h-10 w-10" />
              </div>
            )}
            <div className="w-full">
              <p className="text-sm text-slate-500">
                Partilhe este link ou QR Code. Ao digitalizá-lo, os participantes
                abrem o formulário público e inscrevem-se.
              </p>
              <div className="mt-3 flex w-full items-center gap-2">
                <input
                  readOnly
                  value={link}
                  className="h-9 flex-1 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs text-slate-600 outline-none"
                />
                <Button size="sm" variant="outline" onClick={copiarLink} title="Copiar link">
                  {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <Button
                size="sm"
                variant="navy"
                className="mt-2 gap-2"
                onClick={descarregarQr}
                disabled={!qr}
              >
                <Download className="h-4 w-4" />
                Descarregar PNG
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pesquisa */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Pesquisar por nome, email ou telefone…"
          className="pl-9"
        />
      </div>

      {/* Lista de inscritos */}
      <Card>
        <CardContent className="p-0">
          {inscritos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <Users className="h-8 w-8 text-slate-300" />
              <p className="text-sm text-slate-500">
                {q.trim()
                  ? "Nenhuma inscrição corresponde à pesquisa."
                  : "Ainda não há inscrições neste evento."}
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
                  {inscritos.map((i) => (
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
