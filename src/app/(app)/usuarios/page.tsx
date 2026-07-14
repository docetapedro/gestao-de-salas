"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ROLE_LABELS, type Role } from "@/lib/permissions";
import { Modal, ConfirmDialog } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";

type User = {
  id: string;
  name: string;
  email: string;
  username: string | null;
  role: Role;
  notify: boolean;
  active: boolean;
  createdAt: string;
};

const emptyForm = {
  id: "",
  name: "",
  email: "",
  username: "",
  password: "",
  role: "VIEWER" as Role,
  notify: true,
  active: true,
};

export default function UsuariosPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<User | null>(null);
  const [busyDel, setBusyDel] = useState(false);

  async function load() {
    try {
      const { users } = await api<{ users: User[] }>("/api/users");
      setUsers(users);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setForm(emptyForm);
    setShowForm(true);
    setError(null);
  }

  function openEdit(u: User) {
    setForm({
      id: u.id,
      name: u.name,
      email: u.email,
      username: u.username ?? "",
      password: "",
      role: u.role,
      notify: u.notify,
      active: u.active,
    });
    setShowForm(true);
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: form.name,
        email: form.email,
        username: form.username.trim() || null,
        role: form.role,
        notify: form.notify,
        active: form.active,
      };
      if (form.password) payload.password = form.password;

      if (form.id) {
        await api(`/api/users/${form.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await api("/api/users", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      setShowForm(false);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(u: User) {
    setBusyDel(true);
    try {
      await api(`/api/users/${u.id}`, { method: "DELETE" });
      setToDelete(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusyDel(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Usuários</h1>
          <p className="text-sm text-slate-500">
            Administradores recebem os avisos de evento por email.
          </p>
        </div>
        <Button variant="navy" onClick={openCreate}>
          + Novo usuário
        </Button>
      </div>

      {error && !showForm && (
        <div className="mb-3 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-200">
          {error}
        </div>
      )}

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Carregando…</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Permissão</TableHead>
                <TableHead>Avisos</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium text-slate-800">
                    {u.name}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {u.email}
                    {u.username && (
                      <span className="block text-xs text-slate-400">
                        @{u.username}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        u.role === "ADMIN"
                          ? "default"
                          : u.role === "MANAGER"
                          ? "secondary"
                          : "outline"
                      }
                      className={
                        u.role === "ADMIN"
                          ? "bg-navy text-white"
                          : u.role === "MANAGER"
                          ? "bg-brand-100 text-brand-700"
                          : "bg-slate-100 text-slate-600 border-transparent"
                      }
                    >
                      {ROLE_LABELS[u.role]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {u.role === "ADMIN" ? (u.notify ? "Sim" : "Não") : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.active ? "success" : "secondary"}>
                      {u.active ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      variant="link"
                      size="sm"
                      className="text-brand-600 h-auto p-0 mr-3"
                      onClick={() => openEdit(u)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="link"
                      size="sm"
                      className="text-red-600 h-auto p-0"
                      onClick={() => setToDelete(u)}
                    >
                      Excluir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {showForm && (
        <Modal
          title={form.id ? "Editar usuário" : "Novo usuário"}
          onClose={() => setShowForm(false)}
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                form="user-form"
                variant="navy"
                disabled={saving}
              >
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            </>
          }
        >
          <form id="user-form" onSubmit={save} className="space-y-3">
            {error && (
              <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-200">
                {error}
              </div>
            )}
            <div className="space-y-1">
              <Label htmlFor="user-name">Nome *</Label>
              <Input
                id="user-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="user-email">Email *</Label>
              <Input
                id="user-email"
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="user-username">Nome de utilizador</Label>
              <Input
                id="user-username"
                type="text"
                autoCapitalize="none"
                value={form.username}
                onChange={(e) =>
                  setForm({ ...form, username: e.target.value })
                }
                placeholder="opcional — login por email ou este nome"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="user-password">
                Senha {form.id && "(deixe em branco para manter)"}
                {!form.id && " *"}
              </Label>
              <Input
                id="user-password"
                type="password"
                required={!form.id}
                value={form.password}
                onChange={(e) =>
                  setForm({ ...form, password: e.target.value })
                }
                placeholder={form.id ? "••••••••" : "mín. 6 caracteres"}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="user-role">Permissão *</Label>
              <Select
                value={form.role}
                onValueChange={(v) =>
                  setForm({ ...form, role: v as Role })
                }
              >
                <SelectTrigger id="user-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIEWER">
                    Visualizador — só vê a grade
                  </SelectItem>
                  <SelectItem value="MANAGER">
                    Gestor — gerencia salas e eventos
                  </SelectItem>
                  <SelectItem value="ADMIN">
                    Administrador — tudo + usuários + avisos
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.role === "ADMIN" && (
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.notify}
                  onChange={(e) =>
                    setForm({ ...form, notify: e.target.checked })
                  }
                />
                Receber emails de aviso de evento
              </label>
            )}
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm({ ...form, active: e.target.checked })
                }
              />
              Usuário ativo
            </label>
          </form>
        </Modal>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Excluir usuário"
          message={`Excluir o usuário "${toDelete.name}"?`}
          confirmLabel="Excluir"
          danger
          busy={busyDel}
          onConfirm={() => remove(toDelete)}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
