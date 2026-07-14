"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Modal, ConfirmDialog } from "@/components/Modal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

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
  const [toDelete, setToDelete] = useState<Room | null>(null);
  const [busyDel, setBusyDel] = useState(false);

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

  async function confirmDelete() {
    if (!toDelete) return;
    setBusyDel(true);
    setError(null);
    try {
      await api(`/api/rooms/${toDelete.id}`, { method: "DELETE" });
      setToDelete(null);
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusyDel(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold text-navy">Salas</h1>
        <Button variant="navy" onClick={openCreate}>
          + Nova sala
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
        ) : rooms.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            Nenhuma sala cadastrada.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead>Sala</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Capacidade</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rooms.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <div className="flex items-center gap-2 font-medium text-slate-800">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ background: r.color }}
                      />
                      {r.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {r.location || "—"}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {r.capacity ?? "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={r.active ? "success" : "secondary"}>
                      {r.active ? "Ativa" : "Inativa"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(r)}
                      className="text-brand-600 hover:text-brand-700"
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setToDelete(r)}
                      className="text-red-600 hover:text-red-700"
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
          title={form.id ? "Editar sala" : "Nova sala"}
          onClose={() => setShowForm(false)}
        >
          <form onSubmit={save} className="space-y-3">
            {error && (
              <div className="rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-200">
                {error}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="room-name">Nome *</Label>
              <Input
                id="room-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="room-location">Local</Label>
              <Input
                id="room-location"
                value={form.location}
                onChange={(e) =>
                  setForm({ ...form, location: e.target.value })
                }
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="room-capacity">Capacidade</Label>
                <Input
                  id="room-capacity"
                  type="number"
                  min={0}
                  value={form.capacity}
                  onChange={(e) =>
                    setForm({ ...form, capacity: e.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="room-color">Cor</Label>
                <input
                  id="room-color"
                  type="color"
                  value={form.color}
                  onChange={(e) => setForm({ ...form, color: e.target.value })}
                  className="h-10 w-16 rounded-md border border-input cursor-pointer"
                />
              </div>
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
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setShowForm(false)}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                variant="navy"
                className="flex-1"
                disabled={saving}
              >
                {saving ? "Salvando…" : "Salvar"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {toDelete && (
        <ConfirmDialog
          title="Excluir sala"
          danger
          busy={busyDel}
          confirmLabel="Excluir"
          message={
            <>
              Excluir a sala <b>{toDelete.name}</b>? Os eventos dela também serão
              removidos.
            </>
          }
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  );
}
