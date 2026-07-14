"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, GraduationCap, Coins } from "lucide-react";
import { api } from "@/lib/api";
import { formatNum } from "@/lib/projetos";
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
import { Modal, ConfirmDialog } from "@/components/Modal";
import { MoneyInput } from "@/components/MoneyInput";

export type Rubrica = { id: string; nome: string; tipo: string };
export type FinItem = {
  id: string;
  rubricaId: string;
  previsto: number;
  realizado: number;
  rubrica: { nome: string; tipo: string };
};
export type Turma = {
  id: string;
  codigo: string | null;
  nome: string | null;
  dataInicio: string | null;
  dataFim: string | null;
  financeiro: FinItem[];
};

const msg = (e: unknown) => (e instanceof Error ? e.message : "Erro inesperado");

export default function GestaoTurmas({
  projetoId,
  turmas,
  rubricas,
  onReload,
  extraActions,
}: {
  projetoId: string;
  turmas: Turma[];
  rubricas: Rubrica[];
  onReload: () => Promise<void> | void;
  extraActions?: React.ReactNode;
}) {
  const empty = { codigo: "" };
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<Turma | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<Turma | null>(null);
  const [busyDel, setBusyDel] = useState(false);

  function openNova() {
    setEditing(null);
    setForm(empty);
    setDialog(true);
  }
  function openEdit(t: Turma) {
    setEditing(t);
    setForm({ codigo: t.codigo ?? "" });
    setDialog(true);
  }

  async function submitTurma(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/turmas/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
        toast.success("Turma actualizada");
      } else {
        await api(`/api/projetos/${projetoId}/turmas`, {
          method: "POST",
          body: JSON.stringify(form),
        });
        toast.success("Turma criada");
      }
      setDialog(false);
      await onReload();
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
      await api(`/api/turmas/${del.id}`, { method: "DELETE" });
      toast.success("Turma removida");
      setDel(null);
      await onReload();
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setBusyDel(false);
    }
  }

  return (
    <div className="no-print mb-6">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-brand-600">
            <GraduationCap className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-base font-bold text-navy">Turmas & Lançamentos</h2>
            <p className="text-xs text-muted-foreground">
              Lança as rubricas (previsto/realizado) por turma.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {extraActions}
          <Button onClick={openNova}>
            <Plus /> Nova turma
          </Button>
        </div>
      </div>

      {turmas.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Ainda não há turmas. Cria a primeira para lançar os valores.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {turmas.map((t) => (
            <TurmaCard
              key={t.id}
              turma={t}
              rubricas={rubricas}
              onEdit={() => openEdit(t)}
              onDelete={() => setDel(t)}
              onReload={onReload}
            />
          ))}
        </div>
      )}

      {dialog && (
        <Modal
          title={editing ? "Editar turma" : "Nova turma"}
          onClose={() => setDialog(false)}
          footer={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialog(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" form="turma-form" variant="navy" disabled={saving}>
                {saving ? "A guardar…" : "Guardar"}
              </Button>
            </>
          }
        >
          <form id="turma-form" onSubmit={submitTurma}>
            <Label className="mb-1 block">Código da turma</Label>
            <Input
              autoFocus
              value={form.codigo}
              onChange={(e) => setForm({ codigo: e.target.value })}
              placeholder="Ex.: T1"
            />
          </form>
        </Modal>
      )}

      {del && (
        <ConfirmDialog
          title="Remover turma"
          danger
          busy={busyDel}
          confirmLabel="Remover"
          message={
            <>
              Remover a turma <b>{del.codigo || del.nome || "sem nome"}</b> e
              todos os seus lançamentos?
            </>
          }
          onConfirm={confirmDelete}
          onCancel={() => setDel(null)}
        />
      )}
    </div>
  );
}

/* ------------------------------- Turma card ------------------------------- */
function TurmaCard({
  turma,
  rubricas,
  onEdit,
  onDelete,
  onReload,
}: {
  turma: Turma;
  rubricas: Rubrica[];
  onEdit: () => void;
  onDelete: () => void;
  onReload: () => Promise<void> | void;
}) {
  const [modal, setModal] = useState(false);
  const [rubricaId, setRubricaId] = useState("");
  const [previsto, setPrevisto] = useState("");
  const [realizado, setRealizado] = useState("");
  const [saving, setSaving] = useState(false);
  const [delItem, setDelItem] = useState<FinItem | null>(null);

  // Ao escolher uma rubrica já lançada, pré-preenche os valores para edição.
  function escolherRubrica(id: string) {
    setRubricaId(id);
    const existente = turma.financeiro.find((f) => f.rubricaId === id);
    setPrevisto(existente ? String(existente.previsto) : "");
    setRealizado(existente ? String(existente.realizado) : "");
  }

  async function lancar(e: React.FormEvent) {
    e.preventDefault();
    if (!rubricaId) return toast.error("Escolhe uma rubrica");
    setSaving(true);
    try {
      await api(`/api/turmas/${turma.id}/financeiro`, {
        method: "POST",
        body: JSON.stringify({
          rubricaId,
          previsto: Number(previsto) || 0,
          realizado: Number(realizado) || 0,
        }),
      });
      toast.success("Lançamento guardado");
      setRubricaId("");
      setPrevisto("");
      setRealizado("");
      await onReload();
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setSaving(false);
    }
  }

  async function removerItem() {
    if (!delItem) return;
    try {
      await api(`/api/financeiro/${delItem.id}`, { method: "DELETE" });
      toast.success("Lançamento removido");
      setDelItem(null);
      await onReload();
    } catch (e) {
      toast.error(msg(e));
    }
  }

  const rubricasOrdenadas = [...rubricas].sort((a, b) =>
    a.tipo === b.tipo ? a.nome.localeCompare(b.nome) : a.tipo === "RECEITA" ? -1 : 1
  );

  return (
    <Card className="overflow-hidden">
      {/* Cabeçalho da turma */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <span className="text-sm font-semibold text-slate-800">
          {turma.codigo || "Turma sem código"}
        </span>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Button variant="outline" size="sm" onClick={() => setModal(true)}>
            <Coins /> Lançar rubricas
            {turma.financeiro.length > 0 && (
              <span className="ml-1 rounded-full bg-brand-100 px-1.5 text-[11px] font-semibold text-brand-700">
                {turma.financeiro.length}
              </span>
            )}
          </Button>
          <button
            onClick={onEdit}
            className="text-slate-400 hover:text-brand-600"
            title="Editar turma"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={onDelete}
            className="text-slate-400 hover:text-destructive"
            title="Remover turma"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Modal: lançar/gerir rubricas da turma */}
      {modal && (
        <Modal
          title={`Lançamentos — Turma ${turma.codigo || turma.nome || ""}`}
          maxWidth="max-w-4xl"
          onClose={() => setModal(false)}
        >
          {/* Lançar / actualizar (upsert: se existe, actualiza; senão cria) */}
          <form
            onSubmit={lancar}
            className="flex flex-wrap items-end gap-2 rounded-lg bg-slate-50 p-3"
          >
            <div className="min-w-[12rem] flex-1">
              <Label className="mb-1 block text-xs">Rubrica</Label>
              <Select value={rubricaId} onValueChange={escolherRubrica}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="Escolher rubrica" />
                </SelectTrigger>
                <SelectContent>
                  {rubricasOrdenadas.length === 0 && (
                    <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                      Cria rubricas em Cadastros.
                    </div>
                  )}
                  {rubricasOrdenadas.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.nome} · {r.tipo === "RECEITA" ? "Receita" : "Custo"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="w-36">
              <Label className="mb-1 block text-xs">Previsto (AOA)</Label>
              <MoneyInput
                value={previsto}
                onChange={setPrevisto}
                prefix={null}
                className="bg-white"
              />
            </div>
            <div className="w-36">
              <Label className="mb-1 block text-xs">Realizado (AOA)</Label>
              <MoneyInput
                value={realizado}
                onChange={setRealizado}
                prefix={null}
                className="bg-white"
              />
            </div>
            <Button type="submit" variant="navy" disabled={saving}>
              {saving ? "A guardar…" : "Lançar"}
            </Button>
          </form>

          {/* Lançamentos já feitos (editar/remover) */}
          <div className="mt-4 max-h-96 overflow-y-auto">
            {turma.financeiro.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">
                Ainda sem lançamentos nesta turma.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="pb-1 font-medium">Rubrica</th>
                    <th className="pb-1 text-right font-medium">Previsto</th>
                    <th className="pb-1 text-right font-medium">Realizado</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody>
                  {turma.financeiro.map((f) => (
                    <tr key={f.id} className="border-t border-slate-100">
                      <td className="py-1.5">
                        <span className="text-slate-700">{f.rubrica.nome}</span>
                        <Badge
                          variant={f.rubrica.tipo === "RECEITA" ? "success" : "secondary"}
                          className="ml-2 rounded px-1.5 py-0 text-[10px]"
                        >
                          {f.rubrica.tipo === "RECEITA" ? "Receita" : "Custo"}
                        </Badge>
                      </td>
                      <td className="py-1.5 text-right text-slate-500">
                        {formatNum(f.previsto)}
                      </td>
                      <td className="py-1.5 text-right font-medium text-slate-700">
                        {formatNum(f.realizado)}
                      </td>
                      <td className="py-1.5">
                        <div className="flex items-center justify-end gap-4">
                          <button
                            onClick={() => escolherRubrica(f.rubricaId)}
                            className="text-slate-400 hover:text-brand-600"
                            title="Editar valores"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => setDelItem(f)}
                            className="text-slate-400 hover:text-destructive"
                            title="Remover"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Modal>
      )}

      {delItem && (
        <ConfirmDialog
          title="Remover lançamento"
          danger
          confirmLabel="Remover"
          message={
            <>
              Remover o lançamento de <b>{delItem.rubrica.nome}</b> desta turma?
            </>
          }
          onConfirm={removerItem}
          onCancel={() => setDelItem(null)}
        />
      )}
    </Card>
  );
}
