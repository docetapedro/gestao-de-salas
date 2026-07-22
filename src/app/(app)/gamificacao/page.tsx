"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Modal, ConfirmDialog } from "@/components/Modal";
import { toast } from "sonner";
import {
  CalendarDays,
  MapPin,
  Plus,
  Settings2,
  Trophy,
  Users,
  Gamepad2,
  Pencil,
  Trash2,
} from "lucide-react";

type Evento = {
  id: string;
  nome: string;
  descricao: string | null;
  local: string | null;
  data: string | null;
  ativo: boolean;
  _count: { equipas: number; dinamicas: number };
};

const VAZIO = { nome: "", descricao: "", local: "", data: "" };

function fmtData(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

export default function GamificacaoPage() {
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<null | { id?: string }>(null);
  const [form, setForm] = useState(VAZIO);
  const [saving, setSaving] = useState(false);
  const [remover, setRemover] = useState<Evento | null>(null);
  const [removing, setRemoving] = useState(false);

  function carregar() {
    api<{ eventos: Evento[] }>("/api/gamificacao/eventos")
      .then((d) => setEventos(d.eventos))
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setLoading(false));
  }
  useEffect(carregar, []);

  function abrirNovo() {
    setForm(VAZIO);
    setModal({});
  }
  function abrirEditar(ev: Evento) {
    setForm({
      nome: ev.nome,
      descricao: ev.descricao ?? "",
      local: ev.local ?? "",
      data: ev.data ? ev.data.slice(0, 10) : "",
    });
    setModal({ id: ev.id });
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return;
    setSaving(true);
    try {
      const editando = modal?.id;
      await api(
        editando
          ? `/api/gamificacao/eventos/${editando}`
          : "/api/gamificacao/eventos",
        {
          method: editando ? "PUT" : "POST",
          body: JSON.stringify({
            nome: form.nome.trim(),
            descricao: form.descricao.trim() || null,
            local: form.local.trim() || null,
            data: form.data || null,
          }),
        }
      );
      toast.success(editando ? "Evento actualizado" : "Evento criado");
      setModal(null);
      carregar();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function confirmarRemover() {
    if (!remover) return;
    setRemoving(true);
    try {
      await api(`/api/gamificacao/eventos/${remover.id}`, { method: "DELETE" });
      toast.success("Evento eliminado");
      setRemover(null);
      carregar();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setRemoving(false);
    }
  }

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Gamificação</h1>
          <p className="text-sm text-muted-foreground">
            Eventos de team building: equipas, dinâmicas e ranking ao vivo.
          </p>
        </div>
        <Button variant="navy" onClick={abrirNovo}>
          <Plus /> Novo evento
        </Button>
      </div>

      {loading ? (
        <div className="p-10 text-center text-slate-400">Carregando…</div>
      ) : eventos.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <Trophy className="h-7 w-7" />
            </div>
            <div>
              <p className="font-semibold text-slate-700">
                Ainda não há eventos de team building
              </p>
              <p className="text-sm text-slate-400">
                Cria o primeiro para começar a montar equipas e dinâmicas.
              </p>
            </div>
            <Button variant="navy" onClick={abrirNovo}>
              <Plus /> Criar evento
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {eventos.map((ev) => (
            <Card
              key={ev.id}
              className="group relative overflow-hidden transition hover:shadow-md"
            >
              <div className="h-1.5 w-full bg-gradient-to-r from-brand-500 via-brand-600 to-navy" />
              <CardContent className="p-5">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <Badge variant={ev.ativo ? "default" : "secondary"}>
                    {ev.ativo ? "Activo" : "Encerrado"}
                  </Badge>
                  <div className="flex gap-1 opacity-0 transition group-hover:opacity-100">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title="Editar"
                      onClick={() => abrirEditar(ev)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      title="Eliminar"
                      onClick={() => setRemover(ev)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <Link href={`/gamificacao/${ev.id}`}>
                  <h3 className="text-lg font-bold text-navy hover:text-brand-700">
                    {ev.nome}
                  </h3>
                </Link>
                {ev.descricao && (
                  <p className="mt-0.5 line-clamp-2 text-sm text-slate-500">
                    {ev.descricao}
                  </p>
                )}

                <div className="mt-3 space-y-1 text-sm text-slate-500">
                  {fmtData(ev.data) && (
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-slate-400" />
                      {fmtData(ev.data)}
                    </div>
                  )}
                  {ev.local && (
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-slate-400" />
                      {ev.local}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex items-center gap-4 text-sm">
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <Users className="h-4 w-4 text-brand-500" />
                    <b className="text-navy">{ev._count.equipas}</b> equipas
                  </span>
                  <span className="flex items-center gap-1.5 text-slate-600">
                    <Gamepad2 className="h-4 w-4 text-brand-500" />
                    <b className="text-navy">{ev._count.dinamicas}</b> dinâmicas
                  </span>
                </div>

                <div className="mt-4 flex gap-2">
                  <Button asChild variant="navy" size="sm" className="flex-1">
                    <Link href={`/gamificacao/${ev.id}`}>
                      <Settings2 /> Gerir
                    </Link>
                  </Button>
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/gamificacao/${ev.id}/ranking`}>
                      <Trophy /> Ranking
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {modal && (
        <Modal
          title={modal.id ? "Editar evento" : "Novo evento de team building"}
          onClose={() => setModal(null)}
          footer={
            <>
              <Button variant="outline" onClick={() => setModal(null)}>
                Cancelar
              </Button>
              <Button
                variant="navy"
                onClick={salvar}
                disabled={saving || !form.nome.trim()}
              >
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            </>
          }
        >
          <form onSubmit={salvar} className="space-y-3">
            <div>
              <Label className="mb-1 block">Nome do evento *</Label>
              <Input
                autoFocus
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: Kick-off 2026"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block">Data</Label>
                <Input
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                />
              </div>
              <div>
                <Label className="mb-1 block">Local</Label>
                <Input
                  value={form.local}
                  onChange={(e) => setForm({ ...form, local: e.target.value })}
                  placeholder="Ex.: Talatona"
                />
              </div>
            </div>
            <div>
              <Label className="mb-1 block">Descrição</Label>
              <Textarea
                rows={2}
                value={form.descricao}
                onChange={(e) =>
                  setForm({ ...form, descricao: e.target.value })
                }
                placeholder="Opcional"
              />
            </div>
            <button type="submit" className="hidden" />
          </form>
        </Modal>
      )}

      {remover && (
        <ConfirmDialog
          title="Eliminar evento"
          message={`Eliminar "${remover.nome}"? As equipas, dinâmicas e pontuações deste evento serão apagadas.`}
          confirmLabel="Eliminar"
          danger
          busy={removing}
          onConfirm={confirmarRemover}
          onCancel={() => setRemover(null)}
        />
      )}
    </div>
  );
}
