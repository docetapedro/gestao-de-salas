"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ROLE_LABELS, type Role } from "@/lib/permissions";

type User = {
  id: string;
  name: string;
  email: string;
  role: Role;
  notify: boolean;
  active: boolean;
  createdAt: string;
};

const emptyForm = {
  id: "",
  name: "",
  email: "",
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
    if (!confirm(`Excluir o usuário "${u.name}"?`)) return;
    try {
      await api(`/api/users/${u.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      alert((err as Error).message);
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
        <button
          onClick={openCreate}
          className="rounded-lg bg-navy text-white px-4 py-2 text-sm font-semibold hover:bg-navy-light"
        >
          + Novo usuário
        </button>
      </div>

      {error && !showForm && (
        <div className="mb-3 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-200">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Carregando…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Nome</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Permissão</th>
                <th className="px-4 py-3 font-medium">Avisos</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-800">
                    {u.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.role === "ADMIN"
                          ? "bg-navy text-white"
                          : u.role === "MANAGER"
                          ? "bg-brand-100 text-brand-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {u.role === "ADMIN" ? (u.notify ? "Sim" : "Não") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        u.active
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {u.active ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => openEdit(u)}
                      className="text-brand-600 hover:underline mr-3"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => remove(u)}
                      className="text-red-600 hover:underline"
                    >
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <div
          className="fixed inset-0 bg-black/40 z-40 flex items-center justify-center p-4"
          onClick={() => setShowForm(false)}
        >
          <form
            onSubmit={save}
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden"
          >
            <div className="bg-navy text-white px-5 py-4 font-bold">
              {form.id ? "Editar usuário" : "Novo usuário"}
            </div>
            <div className="p-5 space-y-3">
              {error && (
                <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-200">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nome *
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="input"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Senha {form.id && "(deixe em branco para manter)"}
                  {!form.id && " *"}
                </label>
                <input
                  type="password"
                  required={!form.id}
                  value={form.password}
                  onChange={(e) =>
                    setForm({ ...form, password: e.target.value })
                  }
                  className="input"
                  placeholder={form.id ? "••••••••" : "mín. 6 caracteres"}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Permissão *
                </label>
                <select
                  value={form.role}
                  onChange={(e) =>
                    setForm({ ...form, role: e.target.value as Role })
                  }
                  className="input"
                >
                  <option value="VIEWER">Visualizador — só vê a grade</option>
                  <option value="MANAGER">
                    Gestor — gerencia salas e eventos
                  </option>
                  <option value="ADMIN">
                    Administrador — tudo + usuários + avisos
                  </option>
                </select>
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
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="flex-1 rounded-lg bg-slate-100 hover:bg-slate-200 py-2 text-sm font-medium"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg bg-navy text-white py-2 text-sm font-semibold hover:bg-navy-light disabled:opacity-60"
              >
                {saving ? "Salvando…" : "Salvar"}
              </button>
            </div>
          </form>
        </div>
      )}

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.5rem;
          border: 1px solid #cbd5e1;
          padding: 0.5rem 0.75rem;
          outline: none;
          background: white;
        }
        .input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px #bfdbfe;
        }
      `}</style>
    </div>
  );
}
