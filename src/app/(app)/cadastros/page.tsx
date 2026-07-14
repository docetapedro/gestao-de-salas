"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Modal, ConfirmDialog } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

type Tab = "clientes" | "pilares" | "formadores" | "rubricas";

const TABS: { key: Tab; label: string }[] = [
  { key: "clientes", label: "Clientes" },
  { key: "pilares", label: "Pilares" },
  { key: "formadores", label: "Formadores" },
  { key: "rubricas", label: "Rubricas (Custos/Receitas)" },
];

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50";

export default function CadastrosPage() {
  const [tab, setTab] = useState<Tab>("clientes");

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy mb-1">Cadastros</h1>
      <p className="text-sm text-muted-foreground mb-1">
        Tabelas de apoio usadas pelos projectos.
      </p>
      <p className="text-xs text-muted-foreground mb-4">
        O “Local / Sala” dos projectos usa a página <b>Salas</b>.
      </p>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList className="flex-wrap h-auto">
          {TABS.map((t) => (
            <TabsTrigger key={t.key} value={t.key}>
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="clientes">
          <Clientes />
        </TabsContent>
        <TabsContent value="pilares">
          <Pilares />
        </TabsContent>
        <TabsContent value="formadores">
          <Formadores />
        </TabsContent>
        <TabsContent value="rubricas">
          <Rubricas />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <Card className="max-w-2xl">
      <CardContent className="p-5">{children}</CardContent>
    </Card>
  );
}

function ErrorBox({ msg }: { msg: string | null }) {
  if (!msg) return null;
  return (
    <div className="mb-3 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-200">
      {msg}
    </div>
  );
}

function RowActions({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex gap-1">
      <Button variant="link" size="sm" className="h-auto px-1" onClick={onEdit}>
        Editar
      </Button>
      <Button
        variant="link"
        size="sm"
        className="h-auto px-1 text-red-600"
        onClick={onDelete}
      >
        Excluir
      </Button>
    </div>
  );
}

function ModalFooter({
  onCancel,
  saving,
}: {
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        className="flex-1"
        onClick={onCancel}
      >
        Cancelar
      </Button>
      <Button
        type="submit"
        form="edit-form"
        variant="navy"
        className="flex-1"
        disabled={saving}
      >
        {saving ? "Salvando…" : "Guardar"}
      </Button>
    </>
  );
}

/* --------------------------------- Clientes ------------------------------- */
type C = {
  id: string;
  nome: string;
  tipo: string;
  telefone: string | null;
  email: string | null;
  descricao: string | null;
};
function Clientes() {
  const empty = { nome: "", tipo: "B2C", telefone: "", email: "", descricao: "" };
  const [items, setItems] = useState<C[]>([]);
  const [form, setForm] = useState(empty);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<C | null>(null);
  const [edit, setEdit] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<C | null>(null);
  const [busyDel, setBusyDel] = useState(false);

  async function load() {
    const { clientes } = await api<{ clientes: C[] }>("/api/clientes");
    setItems(clientes);
  }
  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/api/clientes", { method: "POST", body: JSON.stringify(form) });
      setForm(empty);
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function openEdit(c: C) {
    setEditing(c);
    setEdit({
      nome: c.nome,
      tipo: c.tipo,
      telefone: c.telefone ?? "",
      email: c.email ?? "",
      descricao: c.descricao ?? "",
    });
  }
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      await api(`/api/clientes/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify(edit),
      });
      setEditing(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function confirmDelete() {
    if (!toDelete) return;
    setBusyDel(true);
    try {
      await api(`/api/clientes/${toDelete.id}`, { method: "DELETE" });
      setToDelete(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyDel(false);
    }
  }

  return (
    <SectionCard>
      <ErrorBox msg={error} />
      <form onSubmit={add} className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        <Input
          placeholder="Nome do cliente"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
        />
        <select
          className={selectClass}
          value={form.tipo}
          onChange={(e) => setForm({ ...form, tipo: e.target.value })}
        >
          <option value="B2C">B2C</option>
          <option value="B2B">B2B</option>
        </select>
        <Input
          placeholder="Telefone"
          value={form.telefone}
          onChange={(e) => setForm({ ...form, telefone: e.target.value })}
        />
        <Input
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Button type="submit" variant="navy" className="sm:col-span-2">
          Adicionar cliente
        </Button>
      </form>
      <ul className="divide-y divide-slate-100">
        {items.map((c) => (
          <li key={c.id} className="flex items-center justify-between py-2 text-sm">
            <span className="text-slate-700">
              {c.nome}
              <span className="ml-2 text-xs text-muted-foreground">
                {c.tipo}
                {c.email ? ` · ${c.email}` : ""}
              </span>
            </span>
            <RowActions onEdit={() => openEdit(c)} onDelete={() => setToDelete(c)} />
          </li>
        ))}
        {items.length === 0 && (
          <li className="py-2 text-muted-foreground text-sm">Vazio.</li>
        )}
      </ul>

      {editing && (
        <Modal
          title="Editar cliente"
          onClose={() => setEditing(null)}
          footer={<ModalFooter onCancel={() => setEditing(null)} saving={saving} />}
        >
          <form id="edit-form" onSubmit={saveEdit} className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input
                autoFocus
                className="mt-1"
                value={edit.nome}
                onChange={(e) => setEdit({ ...edit, nome: e.target.value })}
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <select
                className={cn(selectClass, "mt-1")}
                value={edit.tipo}
                onChange={(e) => setEdit({ ...edit, tipo: e.target.value })}
              >
                <option value="B2C">B2C</option>
                <option value="B2B">B2B</option>
              </select>
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                className="mt-1"
                value={edit.telefone}
                onChange={(e) => setEdit({ ...edit, telefone: e.target.value })}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                className="mt-1"
                value={edit.email}
                onChange={(e) => setEdit({ ...edit, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea
                className="mt-1"
                rows={2}
                value={edit.descricao}
                onChange={(e) => setEdit({ ...edit, descricao: e.target.value })}
              />
            </div>
          </form>
        </Modal>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Excluir cliente"
          danger
          busy={busyDel}
          confirmLabel="Excluir"
          message={
            <>
              Excluir o cliente <b>{toDelete.nome}</b>?
            </>
          }
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </SectionCard>
  );
}

/* --------------------------------- Pilares -------------------------------- */
type P = { id: string; nome: string };
function Pilares() {
  const [items, setItems] = useState<P[]>([]);
  const [nome, setNome] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<P | null>(null);
  const [editNome, setEditNome] = useState("");
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<P | null>(null);
  const [busyDel, setBusyDel] = useState(false);

  async function load() {
    const { pilares } = await api<{ pilares: P[] }>("/api/pilares");
    setItems(pilares);
  }
  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/api/pilares", { method: "POST", body: JSON.stringify({ nome }) });
      setNome("");
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function openEdit(p: P) {
    setEditing(p);
    setEditNome(p.nome);
  }
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      await api(`/api/pilares/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify({ nome: editNome }),
      });
      setEditing(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function confirmDelete() {
    if (!toDelete) return;
    setBusyDel(true);
    try {
      await api(`/api/pilares/${toDelete.id}`, { method: "DELETE" });
      setToDelete(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyDel(false);
    }
  }

  return (
    <SectionCard>
      <ErrorBox msg={error} />
      <form onSubmit={add} className="flex gap-2 mb-4">
        <Input
          placeholder="Nome do pilar"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
        />
        <Button type="submit" variant="navy" className="whitespace-nowrap">
          Adicionar
        </Button>
      </form>
      <ul className="divide-y divide-slate-100">
        {items.map((p) => (
          <li key={p.id} className="flex items-center justify-between py-2 text-sm">
            <span className="text-slate-700">{p.nome}</span>
            <RowActions onEdit={() => openEdit(p)} onDelete={() => setToDelete(p)} />
          </li>
        ))}
        {items.length === 0 && (
          <li className="py-2 text-muted-foreground text-sm">Vazio.</li>
        )}
      </ul>

      {editing && (
        <Modal
          title="Editar pilar"
          onClose={() => setEditing(null)}
          footer={<ModalFooter onCancel={() => setEditing(null)} saving={saving} />}
        >
          <form id="edit-form" onSubmit={saveEdit}>
            <Label>Nome</Label>
            <Input
              autoFocus
              className="mt-1"
              value={editNome}
              onChange={(e) => setEditNome(e.target.value)}
            />
          </form>
        </Modal>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Excluir pilar"
          danger
          busy={busyDel}
          confirmLabel="Excluir"
          message={
            <>
              Tens a certeza que queres excluir o pilar{" "}
              <b>{toDelete.nome}</b>?
            </>
          }
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </SectionCard>
  );
}

/* -------------------------------- Formadores ------------------------------ */
type F = {
  id: string;
  nome: string;
  tipo: string;
  telefone: string | null;
  email: string | null;
};
function Formadores() {
  const [items, setItems] = useState<F[]>([]);
  const [form, setForm] = useState({ nome: "", tipo: "INTERNO", telefone: "", email: "" });
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<F | null>(null);
  const [edit, setEdit] = useState({ nome: "", tipo: "INTERNO", telefone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<F | null>(null);
  const [busyDel, setBusyDel] = useState(false);

  async function load() {
    const { formadores } = await api<{ formadores: F[] }>("/api/formadores");
    setItems(formadores);
  }
  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/api/formadores", { method: "POST", body: JSON.stringify(form) });
      setForm({ nome: "", tipo: "INTERNO", telefone: "", email: "" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function openEdit(f: F) {
    setEditing(f);
    setEdit({
      nome: f.nome,
      tipo: f.tipo,
      telefone: f.telefone ?? "",
      email: f.email ?? "",
    });
  }
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      await api(`/api/formadores/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify(edit),
      });
      setEditing(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function confirmDelete() {
    if (!toDelete) return;
    setBusyDel(true);
    try {
      await api(`/api/formadores/${toDelete.id}`, { method: "DELETE" });
      setToDelete(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyDel(false);
    }
  }

  return (
    <SectionCard>
      <ErrorBox msg={error} />
      <form onSubmit={add} className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        <Input
          placeholder="Nome"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
        />
        <select
          className={selectClass}
          value={form.tipo}
          onChange={(e) => setForm({ ...form, tipo: e.target.value })}
        >
          <option value="INTERNO">Interno</option>
          <option value="EXTERNO">Externo</option>
        </select>
        <Input
          placeholder="Telefone"
          value={form.telefone}
          onChange={(e) => setForm({ ...form, telefone: e.target.value })}
        />
        <Input
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
        />
        <Button type="submit" variant="navy" className="sm:col-span-2">
          Adicionar formador
        </Button>
      </form>
      <ul className="divide-y divide-slate-100">
        {items.map((f) => (
          <li key={f.id} className="flex items-center justify-between py-2 text-sm">
            <span className="text-slate-700">
              {f.nome}
              <span className="ml-2 text-xs text-muted-foreground">
                {f.tipo === "EXTERNO" ? "Externo" : "Interno"}
                {f.email ? ` · ${f.email}` : ""}
              </span>
            </span>
            <RowActions onEdit={() => openEdit(f)} onDelete={() => setToDelete(f)} />
          </li>
        ))}
        {items.length === 0 && (
          <li className="py-2 text-muted-foreground text-sm">Vazio.</li>
        )}
      </ul>

      {editing && (
        <Modal
          title="Editar formador"
          onClose={() => setEditing(null)}
          footer={<ModalFooter onCancel={() => setEditing(null)} saving={saving} />}
        >
          <form id="edit-form" onSubmit={saveEdit} className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input
                autoFocus
                className="mt-1"
                value={edit.nome}
                onChange={(e) => setEdit({ ...edit, nome: e.target.value })}
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <select
                className={cn(selectClass, "mt-1")}
                value={edit.tipo}
                onChange={(e) => setEdit({ ...edit, tipo: e.target.value })}
              >
                <option value="INTERNO">Interno</option>
                <option value="EXTERNO">Externo</option>
              </select>
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                className="mt-1"
                value={edit.telefone}
                onChange={(e) => setEdit({ ...edit, telefone: e.target.value })}
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                className="mt-1"
                value={edit.email}
                onChange={(e) => setEdit({ ...edit, email: e.target.value })}
              />
            </div>
          </form>
        </Modal>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Excluir formador"
          danger
          busy={busyDel}
          confirmLabel="Excluir"
          message={
            <>
              Excluir o formador <b>{toDelete.nome}</b>?
            </>
          }
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </SectionCard>
  );
}

/* --------------------------------- Rubricas ------------------------------- */
type R = { id: string; nome: string; tipo: string; ordem: number };
function Rubricas() {
  const [items, setItems] = useState<R[]>([]);
  const [form, setForm] = useState({ nome: "", tipo: "CUSTO" });
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<R | null>(null);
  const [edit, setEdit] = useState({ nome: "", tipo: "CUSTO" });
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<R | null>(null);
  const [busyDel, setBusyDel] = useState(false);

  async function load() {
    const { rubricas } = await api<{ rubricas: R[] }>("/api/rubricas");
    setItems(rubricas);
  }
  useEffect(() => {
    load().catch((e) => setError((e as Error).message));
  }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/api/rubricas", { method: "POST", body: JSON.stringify(form) });
      setForm({ nome: "", tipo: "CUSTO" });
      await load();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  function openEdit(r: R) {
    setEditing(r);
    setEdit({ nome: r.nome, tipo: r.tipo });
  }
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      await api(`/api/rubricas/${editing.id}`, {
        method: "PUT",
        body: JSON.stringify(edit),
      });
      setEditing(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }
  async function confirmDelete() {
    if (!toDelete) return;
    setBusyDel(true);
    try {
      await api(`/api/rubricas/${toDelete.id}`, { method: "DELETE" });
      setToDelete(null);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyDel(false);
    }
  }

  const receitas = items.filter((r) => r.tipo === "RECEITA");
  const custos = items.filter((r) => r.tipo === "CUSTO");

  return (
    <SectionCard>
      <ErrorBox msg={error} />
      <form onSubmit={add} className="flex flex-wrap gap-2 mb-4 items-center">
        <Input
          className="flex-1 min-w-[12rem]"
          placeholder="Nome da rubrica"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
        />
        <select
          className={cn(selectClass, "w-36")}
          value={form.tipo}
          onChange={(e) => setForm({ ...form, tipo: e.target.value })}
        >
          <option value="CUSTO">Custo</option>
          <option value="RECEITA">Receita</option>
        </select>
        <Button type="submit" variant="navy">
          Adicionar
        </Button>
      </form>

      {[
        { title: "Receitas", list: receitas },
        { title: "Custos", list: custos },
      ].map((grp) => (
        <div key={grp.title} className="mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-1">
            {grp.title}
          </p>
          <ul className="divide-y divide-slate-100">
            {grp.list.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-slate-700">{r.nome}</span>
                <RowActions onEdit={() => openEdit(r)} onDelete={() => setToDelete(r)} />
              </li>
            ))}
            {grp.list.length === 0 && (
              <li className="py-2 text-muted-foreground text-sm">Vazio.</li>
            )}
          </ul>
        </div>
      ))}

      {editing && (
        <Modal
          title="Editar rubrica"
          onClose={() => setEditing(null)}
          footer={<ModalFooter onCancel={() => setEditing(null)} saving={saving} />}
        >
          <form id="edit-form" onSubmit={saveEdit} className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input
                autoFocus
                className="mt-1"
                value={edit.nome}
                onChange={(e) => setEdit({ ...edit, nome: e.target.value })}
              />
            </div>
            <div>
              <Label>Tipo</Label>
              <select
                className={cn(selectClass, "mt-1")}
                value={edit.tipo}
                onChange={(e) => setEdit({ ...edit, tipo: e.target.value })}
              >
                <option value="CUSTO">Custo</option>
                <option value="RECEITA">Receita</option>
              </select>
            </div>
          </form>
        </Modal>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Excluir rubrica"
          danger
          busy={busyDel}
          confirmLabel="Excluir"
          message={
            <>
              Excluir a rubrica <b>{toDelete.nome}</b>?
            </>
          }
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </SectionCard>
  );
}
