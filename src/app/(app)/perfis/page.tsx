"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, ShieldCheck, Eye, Lock } from "lucide-react";
import { api } from "@/lib/api";
import { MODULOS, type ModuloKey, type Nivel } from "@/lib/permissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal, ConfirmDialog } from "@/components/Modal";
import { cn } from "@/lib/utils";

type Perfil = {
  id: string;
  nome: string;
  descricao: string | null;
  permissoes: string; // JSON
  sistema: boolean;
};

type NivelSel = "none" | Nivel;

const NIVEIS: { key: NivelSel; label: string; Icon: typeof Eye }[] = [
  { key: "none", label: "Sem acesso", Icon: Lock },
  { key: "view", label: "Ver", Icon: Eye },
  { key: "manage", label: "Gerir", Icon: ShieldCheck },
];

const msg = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado");

function parsePerms(json: string): Record<ModuloKey, NivelSel> {
  let obj: Record<string, unknown> = {};
  try {
    obj = JSON.parse(json || "{}");
  } catch {
    obj = {};
  }
  const out = {} as Record<ModuloKey, NivelSel>;
  for (const m of MODULOS) {
    const v = obj[m.key];
    out[m.key] = v === "view" || v === "manage" ? v : "none";
  }
  return out;
}

export default function PerfisPage() {
  const [perfis, setPerfis] = useState<Perfil[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Perfil | null>(null);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<Perfil | null>(null);
  const [busyDel, setBusyDel] = useState(false);

  const emptyPerms = useMemo(() => {
    const o = {} as Record<ModuloKey, NivelSel>;
    for (const m of MODULOS) o[m.key] = "none";
    return o;
  }, []);

  const [form, setForm] = useState({
    nome: "",
    descricao: "",
    perms: emptyPerms,
  });

  async function load() {
    const { perfis } = await api<{ perfis: Perfil[] }>("/api/perfis");
    setPerfis(perfis);
  }
  useEffect(() => {
    load()
      .catch((e) => toast.error(msg(e)))
      .finally(() => setLoading(false));
  }, []);

  function openNovo() {
    setEditing(null);
    setForm({ nome: "", descricao: "", perms: emptyPerms });
    setOpen(true);
  }
  function openEdit(p: Perfil) {
    setEditing(p);
    setForm({
      nome: p.nome,
      descricao: p.descricao ?? "",
      perms: parsePerms(p.permissoes),
    });
    setOpen(true);
  }

  function setNivel(modulo: ModuloKey, nivel: NivelSel) {
    setForm((f) => ({ ...f, perms: { ...f.perms, [modulo]: nivel } }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return toast.error("Nome do perfil é obrigatório");
    setSaving(true);
    // Converte para o formato { modulo: "view"|"manage" } (omite "none").
    const permissoes: Record<string, Nivel> = {};
    for (const m of MODULOS) {
      const v = form.perms[m.key];
      if (v === "view" || v === "manage") permissoes[m.key] = v;
    }
    try {
      const body = JSON.stringify({
        nome: form.nome,
        descricao: form.descricao,
        permissoes,
      });
      if (editing) {
        await api(`/api/perfis/${editing.id}`, { method: "PUT", body });
        toast.success("Perfil actualizado");
      } else {
        await api("/api/perfis", { method: "POST", body });
        toast.success("Perfil criado");
      }
      setOpen(false);
      await load();
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!del) return;
    setBusyDel(true);
    try {
      await api(`/api/perfis/${del.id}`, { method: "DELETE" });
      toast.success("Perfil eliminado");
      setDel(null);
      await load();
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setBusyDel(false);
    }
  }

  function resumo(p: Perfil) {
    const perms = parsePerms(p.permissoes);
    const geridos = MODULOS.filter((m) => perms[m.key] === "manage").length;
    const vistos = MODULOS.filter((m) => perms[m.key] === "view").length;
    return `${geridos} a gerir · ${vistos} a ver`;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy">Perfis de acesso</h1>
          <p className="text-sm text-muted-foreground">
            Define o que cada perfil pode <b>ver</b> ou <b>gerir</b> em cada módulo.
          </p>
        </div>
        <Button variant="navy" onClick={openNovo}>
          <Plus /> Novo perfil
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-slate-400">A carregar…</div>
          ) : perfis.length === 0 ? (
            <div className="p-8 text-center text-slate-400">Sem perfis.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {perfis.map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">{p.nome}</span>
                      {p.sistema && (
                        <Badge variant="secondary" className="text-[10px]">
                          Sistema
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {p.descricao ? `${p.descricao} · ` : ""}
                      {resumo(p)}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-3 text-sm">
                    <button
                      onClick={() => openEdit(p)}
                      className="text-brand-600 hover:underline"
                    >
                      Editar
                    </button>
                    {!p.sistema && (
                      <button
                        onClick={() => setDel(p)}
                        className="text-destructive hover:underline"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {open && (
        <Modal
          title={editing ? "Editar perfil" : "Novo perfil"}
          maxWidth="max-w-xl"
          onClose={() => setOpen(false)}
          footer={
            <>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                form="perfil-form"
                variant="navy"
                disabled={saving}
              >
                {saving ? "A guardar…" : "Guardar"}
              </Button>
            </>
          }
        >
          <form id="perfil-form" onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <Label className="mb-1 block">Nome</Label>
                <Input
                  autoFocus
                  value={form.nome}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="Ex.: Gestor de Stock"
                />
              </div>
              <div>
                <Label className="mb-1 block">Descrição</Label>
                <Input
                  value={form.descricao}
                  onChange={(e) =>
                    setForm({ ...form, descricao: e.target.value })
                  }
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Permissões por módulo</Label>
              <div className="space-y-1.5">
                {MODULOS.map((m) => (
                  <div
                    key={m.key}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <span className="text-sm font-medium text-slate-700">
                      {m.label}
                    </span>
                    <div className="flex gap-1">
                      {NIVEIS.map(({ key, label, Icon }) => {
                        const active = form.perms[m.key] === key;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => setNivel(m.key, key)}
                            className={cn(
                              "flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                              active
                                ? key === "manage"
                                  ? "border-brand-500 bg-brand-50 text-brand-700"
                                  : key === "view"
                                    ? "border-slate-400 bg-slate-100 text-slate-700"
                                    : "border-slate-300 bg-slate-50 text-slate-500"
                                : "border-slate-200 text-slate-400 hover:bg-slate-50"
                            )}
                          >
                            <Icon className="h-3.5 w-3.5" /> {label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </form>
        </Modal>
      )}

      {del && (
        <ConfirmDialog
          title="Eliminar perfil"
          danger
          busy={busyDel}
          confirmLabel="Eliminar"
          message={
            <>
              Eliminar o perfil <b>{del.nome}</b>? Os utilizadores com este perfil
              ficam sem perfil (passam a usar o papel base).
            </>
          }
          onConfirm={confirmDelete}
          onCancel={() => setDel(null)}
        />
      )}
    </div>
  );
}
