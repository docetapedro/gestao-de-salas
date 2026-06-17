"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

type Room = {
  id: string;
  name: string;
  location: string | null;
  capacity: number | null;
  color: string;
  active: boolean;
};

const emptyForm = {
  id: "",
  name: "",
  location: "",
  capacity: "",
  color: "#1d4ed8",
  active: true,
};

export default function SalasPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function load() {
    try {
      const { rooms } = await api<{ rooms: Room[] }>("/api/rooms");
      setRooms(rooms);
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

  function openEdit(r: Room) {
    setForm({
      id: r.id,
      name: r.name,
      location: r.location || "",
      capacity: r.capacity ? String(r.capacity) : "",
      color: r.color,
      active: r.active,
    });
    setShowForm(true);
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: form.name,
        location: form.location || null,
        capacity: form.capacity ? Number(form.capacity) : null,
        color: form.color,
        active: form.active,
      };
      if (form.id) {
        await api(`/api/rooms/${form.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        await api("/api/rooms", {
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

  async function remove(r: Room) {
    if (!confirm(`Excluir a sala "${r.name}"? Os eventos dela também serão removidos.`))
      return;
    try {
      await api(`/api/rooms/${r.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      alert((err as Error).message);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-navy">Salas</h1>
        <button
          onClick={openCreate}
          className="rounded-lg bg-navy text-white px-4 py-2 text-sm font-semibold hover:bg-navy-light"
        >
          + Nova sala
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
        ) : rooms.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            Nenhuma sala cadastrada.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Sala</th>
                <th className="px-4 py-3 font-medium">Local</th>
                <th className="px-4 py-3 font-medium">Capacidade</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rooms.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 font-medium text-slate-800">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ background: r.color }}
                      />
                      {r.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.location || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {r.capacity ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.active
                          ? "bg-brand-100 text-brand-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {r.active ? "Ativa" : "Inativa"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button
                      onClick={() => openEdit(r)}
                      className="text-brand-600 hover:underline mr-3"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => remove(r)}
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
              {form.id ? "Editar sala" : "Nova sala"}
            </div>
            <div className="p-5 space-y-3">
              {error && (
                <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-200">
                  {error}
                </div>
              )}
              <Field label="Nome *">
                <input
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="input"
                />
              </Field>
              <Field label="Local">
                <input
                  value={form.location}
                  onChange={(e) =>
                    setForm({ ...form, location: e.target.value })
                  }
                  className="input"
                />
              </Field>
              <div className="flex gap-3">
                <Field label="Capacidade">
                  <input
                    type="number"
                    min={0}
                    value={form.capacity}
                    onChange={(e) =>
                      setForm({ ...form, capacity: e.target.value })
                    }
                    className="input"
                  />
                </Field>
                <Field label="Cor">
                  <input
                    type="color"
                    value={form.color}
                    onChange={(e) => setForm({ ...form, color: e.target.value })}
                    className="h-10 w-16 rounded-lg border border-slate-300"
                  />
                </Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(e) =>
                    setForm({ ...form, active: e.target.checked })
                  }
                />
                Sala ativa
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
        }
        .input:focus {
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px #bfdbfe;
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1">
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
