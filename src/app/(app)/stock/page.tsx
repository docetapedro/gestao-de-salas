"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownCircle,
  ArrowUpCircle,
  Boxes,
  Package,
  Plus,
  Trash2,
  TriangleAlert,
  Truck,
} from "lucide-react";

import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/* --------------------------------- Tipos ---------------------------------- */
type Produto = {
  id: string;
  nome: string;
  unidade: string;
  stockMinimo: number | null;
  descricao: string | null;
  ativo: boolean;
  saldo: number;
};
type Fornecedor = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  descricao: string | null;
};
type Cliente = { id: string; nome: string; tipo: string };
type Movimento = {
  id: string;
  tipo: "ENTRADA" | "SAIDA";
  quantidade: number;
  data: string;
  remanescente: number;
  observacao: string | null;
  produto: { id: string; nome: string; unidade: string };
  fornecedor: { id: string; nome: string } | null;
  cliente: { id: string; nome: string } | null;
};

/* ------------------------------- Utilitários ------------------------------ */
const nf = new Intl.NumberFormat("pt-PT");
function fmtData(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("pt-PT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
function hoje() {
  return new Date().toISOString().slice(0, 10);
}
function msg(e: unknown) {
  return e instanceof Error ? e.message : "Erro inesperado";
}

/* ================================ Página ================================== */
export default function StockPage() {
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [fornecedores, setFornecedores] = useState<Fornecedor[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [movimentos, setMovimentos] = useState<Movimento[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    const [p, f, c, m] = await Promise.all([
      api<{ produtos: Produto[] }>("/api/produtos"),
      api<{ fornecedores: Fornecedor[] }>("/api/fornecedores"),
      api<{ clientes: Cliente[] }>("/api/clientes"),
      api<{ movimentos: Movimento[] }>("/api/stock/movimentos"),
    ]);
    setProdutos(p.produtos);
    setFornecedores(f.fornecedores);
    setClientes(c.clientes);
    setMovimentos(m.movimentos);
  }, []);

  useEffect(() => {
    loadAll()
      .catch((e) => toast.error(msg(e)))
      .finally(() => setLoading(false));
  }, [loadAll]);

  const totais = useMemo(() => {
    const totalStock = produtos.reduce((s, p) => s + p.saldo, 0);
    const abaixoMin = produtos.filter(
      (p) => p.stockMinimo != null && p.saldo <= p.stockMinimo
    ).length;
    return { totalStock, abaixoMin, nProdutos: produtos.length };
  }, [produtos]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Controlo de Stock</h1>
        <p className="text-sm text-muted-foreground">
          Entradas e saídas, produtos e fornecedores.
        </p>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <ResumoCard
          icon={<Boxes className="h-5 w-5" />}
          label="Stock total"
          value={nf.format(totais.totalStock)}
          tone="brand"
        />
        <ResumoCard
          icon={<Package className="h-5 w-5" />}
          label="Produtos"
          value={nf.format(totais.nProdutos)}
          tone="slate"
        />
        <ResumoCard
          icon={<Truck className="h-5 w-5" />}
          label="Fornecedores"
          value={nf.format(fornecedores.length)}
          tone="slate"
        />
        <ResumoCard
          icon={<TriangleAlert className="h-5 w-5" />}
          label="Stock baixo"
          value={nf.format(totais.abaixoMin)}
          tone={totais.abaixoMin > 0 ? "warning" : "slate"}
        />
      </div>

      <Tabs defaultValue="movimentos">
        <TabsList>
          <TabsTrigger value="movimentos">
            <Boxes className="mr-1" /> Movimentos
          </TabsTrigger>
          <TabsTrigger value="produtos">
            <Package className="mr-1" /> Produtos
          </TabsTrigger>
          <TabsTrigger value="fornecedores">
            <Truck className="mr-1" /> Fornecedores
          </TabsTrigger>
        </TabsList>

        <TabsContent value="movimentos">
          <MovimentosTab
            loading={loading}
            movimentos={movimentos}
            produtos={produtos}
            fornecedores={fornecedores}
            clientes={clientes}
            reload={loadAll}
          />
        </TabsContent>
        <TabsContent value="produtos">
          <ProdutosTab loading={loading} produtos={produtos} reload={loadAll} />
        </TabsContent>
        <TabsContent value="fornecedores">
          <FornecedoresTab
            loading={loading}
            fornecedores={fornecedores}
            reload={loadAll}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------ Resumo card ------------------------------- */
function ResumoCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  tone: "brand" | "slate" | "warning";
}) {
  const tones = {
    brand: "bg-brand-50 text-brand-600",
    slate: "bg-slate-100 text-slate-500",
    warning: "bg-amber-100 text-amber-600",
  };
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={cn("rounded-lg p-2", tones[tone])}>{icon}</div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className="text-xl font-bold text-navy">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------------------- Confirmar exclusão --------------------------- */
function ConfirmDelete({
  open,
  onOpenChange,
  onConfirm,
  title,
  children,
  busy,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  title: string;
  children: React.ReactNode;
  busy: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{children}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={busy}>
            {busy ? "A excluir…" : "Excluir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={cols} className="py-8 text-center text-muted-foreground">
        {text}
      </TableCell>
    </TableRow>
  );
}

/* ============================ Tab: Movimentos ============================= */
function MovimentosTab({
  loading,
  movimentos,
  produtos,
  fornecedores,
  clientes,
  reload,
}: {
  loading: boolean;
  movimentos: Movimento[];
  produtos: Produto[];
  fornecedores: Fornecedor[];
  clientes: Cliente[];
  reload: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [filtroProduto, setFiltroProduto] = useState<string>("todos");
  const [filtroTipo, setFiltroTipo] = useState<string>("todos");
  const [del, setDel] = useState<Movimento | null>(null);
  const [busyDel, setBusyDel] = useState(false);

  const empty = {
    tipo: "ENTRADA" as "ENTRADA" | "SAIDA",
    produtoId: "",
    quantidade: "",
    data: hoje(),
    fornecedorId: "",
    clienteId: "",
    observacao: "",
  };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const filtrados = useMemo(
    () =>
      movimentos.filter(
        (m) =>
          (filtroProduto === "todos" || m.produto.id === filtroProduto) &&
          (filtroTipo === "todos" || m.tipo === filtroTipo)
      ),
    [movimentos, filtroProduto, filtroTipo]
  );

  function openNovo() {
    setForm({ ...empty, data: hoje() });
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.produtoId) return toast.error("Escolhe um produto");
    setSaving(true);
    try {
      await api("/api/stock/movimentos", {
        method: "POST",
        body: JSON.stringify(form),
      });
      toast.success(
        form.tipo === "ENTRADA" ? "Entrada registada" : "Saída registada"
      );
      setOpen(false);
      await reload();
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
      await api(`/api/stock/movimentos/${del.id}`, { method: "DELETE" });
      toast.success("Movimento excluído");
      setDel(null);
      await reload();
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setBusyDel(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Select value={filtroProduto} onValueChange={setFiltroProduto}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Produto" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os produtos</SelectItem>
              {produtos.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroTipo} onValueChange={setFiltroTipo}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Entradas e saídas</SelectItem>
              <SelectItem value="ENTRADA">Só entradas</SelectItem>
              <SelectItem value="SAIDA">Só saídas</SelectItem>
            </SelectContent>
          </Select>
          <Button className="ml-auto" onClick={openNovo}>
            <Plus /> Novo movimento
          </Button>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Produto</TableHead>
              <TableHead>Movimento</TableHead>
              <TableHead>Fornecedor / Cliente</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead className="text-right">Remanescente</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <EmptyRow cols={7} text="A carregar…" />
            ) : filtrados.length === 0 ? (
              <EmptyRow cols={7} text="Sem movimentos." />
            ) : (
              filtrados.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {fmtData(m.data)}
                  </TableCell>
                  <TableCell className="font-medium text-slate-800">
                    {m.produto.nome}
                  </TableCell>
                  <TableCell>
                    {m.tipo === "ENTRADA" ? (
                      <Badge variant="success" className="gap-1">
                        <ArrowDownCircle className="h-3.5 w-3.5" /> Entrada
                      </Badge>
                    ) : (
                      <Badge variant="warning" className="gap-1">
                        <ArrowUpCircle className="h-3.5 w-3.5" /> Saída
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-600">
                    {m.fornecedor?.nome ?? m.cliente?.nome ?? "—"}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {m.tipo === "ENTRADA" ? "+" : "−"}
                    {nf.format(m.quantidade)}
                  </TableCell>
                  <TableCell className="text-right font-semibold text-navy">
                    {nf.format(m.remanescente)}
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => setDel(m)}
                      className="text-slate-400 transition-colors hover:text-destructive"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      {/* Diálogo: novo movimento */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo movimento</DialogTitle>
            <DialogDescription>
              Registar uma entrada (de fornecedor) ou saída (para cliente).
            </DialogDescription>
          </DialogHeader>
          <form id="mov-form" onSubmit={submit} className="space-y-4">
            {/* Toggle tipo */}
            <div className="grid grid-cols-2 gap-2">
              {(["ENTRADA", "SAIDA"] as const).map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => setForm({ ...form, tipo: t })}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-lg border py-2 text-sm font-medium transition-colors",
                    form.tipo === t
                      ? t === "ENTRADA"
                        ? "border-green-500 bg-green-50 text-green-700"
                        : "border-amber-500 bg-amber-50 text-amber-700"
                      : "border-slate-200 text-slate-500 hover:bg-slate-50"
                  )}
                >
                  {t === "ENTRADA" ? (
                    <>
                      <ArrowDownCircle className="h-4 w-4" /> Entrada
                    </>
                  ) : (
                    <>
                      <ArrowUpCircle className="h-4 w-4" /> Saída
                    </>
                  )}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label className="mb-1 block">Produto</Label>
                <Select
                  value={form.produtoId}
                  onValueChange={(v) => setForm({ ...form, produtoId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Escolher produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {produtos.length === 0 && (
                      <div className="px-2 py-3 text-center text-sm text-muted-foreground">
                        Cria um produto primeiro.
                      </div>
                    )}
                    {produtos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.nome} · {nf.format(p.saldo)} {p.unidade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="mb-1 block">Quantidade</Label>
                <Input
                  type="number"
                  min={1}
                  value={form.quantidade}
                  onChange={(e) =>
                    setForm({ ...form, quantidade: e.target.value })
                  }
                  placeholder="0"
                />
              </div>
              <div>
                <Label className="mb-1 block">Data</Label>
                <Input
                  type="date"
                  value={form.data}
                  onChange={(e) => setForm({ ...form, data: e.target.value })}
                />
              </div>

              {form.tipo === "ENTRADA" ? (
                <div className="col-span-2">
                  <Label className="mb-1 block">Fornecedor</Label>
                  <Select
                    value={form.fornecedorId}
                    onValueChange={(v) => setForm({ ...form, fornecedorId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Escolher fornecedor (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {fornecedores.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="col-span-2">
                  <Label className="mb-1 block">Cliente</Label>
                  <Select
                    value={form.clienteId}
                    onValueChange={(v) => setForm({ ...form, clienteId: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Escolher cliente (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="col-span-2">
                <Label className="mb-1 block">Observação</Label>
                <Input
                  value={form.observacao}
                  onChange={(e) =>
                    setForm({ ...form, observacao: e.target.value })
                  }
                  placeholder="Opcional"
                />
              </div>
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="mov-form" disabled={saving}>
              {saving ? "A guardar…" : "Registar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={!!del}
        onOpenChange={(v) => !v && setDel(null)}
        onConfirm={confirmDelete}
        title="Excluir movimento"
        busy={busyDel}
      >
        Excluir este movimento de <b>{del?.produto.nome}</b>? O remanescente será
        recalculado.
      </ConfirmDelete>
    </Card>
  );
}

/* ============================= Tab: Produtos ============================== */
function ProdutosTab({
  loading,
  produtos,
  reload,
}: {
  loading: boolean;
  produtos: Produto[];
  reload: () => Promise<void>;
}) {
  const empty = { nome: "", unidade: "un", stockMinimo: "", descricao: "" };
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Produto | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<Produto | null>(null);
  const [busyDel, setBusyDel] = useState(false);

  function openNovo() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }
  function openEdit(p: Produto) {
    setEditing(p);
    setForm({
      nome: p.nome,
      unidade: p.unidade,
      stockMinimo: p.stockMinimo?.toString() ?? "",
      descricao: p.descricao ?? "",
    });
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/produtos/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
        toast.success("Produto actualizado");
      } else {
        await api("/api/produtos", {
          method: "POST",
          body: JSON.stringify(form),
        });
        toast.success("Produto criado");
      }
      setOpen(false);
      await reload();
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
      await api(`/api/produtos/${del.id}`, { method: "DELETE" });
      toast.success("Produto excluído");
      setDel(null);
      await reload();
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setBusyDel(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-4 flex justify-end">
          <Button onClick={openNovo}>
            <Plus /> Novo produto
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Unidade</TableHead>
              <TableHead className="text-right">Stock atual</TableHead>
              <TableHead className="text-right">Mínimo</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <EmptyRow cols={5} text="A carregar…" />
            ) : produtos.length === 0 ? (
              <EmptyRow cols={5} text="Sem produtos. Cria o primeiro." />
            ) : (
              produtos.map((p) => {
                const baixo = p.stockMinimo != null && p.saldo <= p.stockMinimo;
                return (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium text-slate-800">
                      {p.nome}
                      {!p.ativo && (
                        <span className="ml-2 text-xs text-slate-400">
                          (inactivo)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-slate-500">{p.unidade}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={baixo ? "destructive" : "secondary"}>
                        {nf.format(p.saldo)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-slate-500">
                      {p.stockMinimo != null ? nf.format(p.stockMinimo) : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-3 text-sm">
                        <button
                          onClick={() => openEdit(p)}
                          className="text-brand-600 hover:underline"
                        >
                          Editar
                        </button>
                        <button
                          onClick={() => setDel(p)}
                          className="text-destructive hover:underline"
                        >
                          Excluir
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>
          <form id="prod-form" onSubmit={submit} className="space-y-3">
            <div>
              <Label className="mb-1 block">Nome</Label>
              <Input
                autoFocus
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: Canetas"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block">Unidade</Label>
                <Input
                  value={form.unidade}
                  onChange={(e) => setForm({ ...form, unidade: e.target.value })}
                  placeholder="un"
                />
              </div>
              <div>
                <Label className="mb-1 block">Stock mínimo</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.stockMinimo}
                  onChange={(e) =>
                    setForm({ ...form, stockMinimo: e.target.value })
                  }
                  placeholder="Opcional"
                />
              </div>
            </div>
            <div>
              <Label className="mb-1 block">Descrição</Label>
              <Input
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Opcional"
              />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="prod-form" disabled={saving}>
              {saving ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={!!del}
        onOpenChange={(v) => !v && setDel(null)}
        onConfirm={confirmDelete}
        title="Excluir produto"
        busy={busyDel}
      >
        Excluir o produto <b>{del?.nome}</b>?
      </ConfirmDelete>
    </Card>
  );
}

/* =========================== Tab: Fornecedores =========================== */
function FornecedoresTab({
  loading,
  fornecedores,
  reload,
}: {
  loading: boolean;
  fornecedores: Fornecedor[];
  reload: () => Promise<void>;
}) {
  const empty = { nome: "", telefone: "", email: "", descricao: "" };
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Fornecedor | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState<Fornecedor | null>(null);
  const [busyDel, setBusyDel] = useState(false);

  function openNovo() {
    setEditing(null);
    setForm(empty);
    setOpen(true);
  }
  function openEdit(f: Fornecedor) {
    setEditing(f);
    setForm({
      nome: f.nome,
      telefone: f.telefone ?? "",
      email: f.email ?? "",
      descricao: f.descricao ?? "",
    });
    setOpen(true);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.nome.trim()) return toast.error("Nome é obrigatório");
    setSaving(true);
    try {
      if (editing) {
        await api(`/api/fornecedores/${editing.id}`, {
          method: "PUT",
          body: JSON.stringify(form),
        });
        toast.success("Fornecedor actualizado");
      } else {
        await api("/api/fornecedores", {
          method: "POST",
          body: JSON.stringify(form),
        });
        toast.success("Fornecedor criado");
      }
      setOpen(false);
      await reload();
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
      await api(`/api/fornecedores/${del.id}`, { method: "DELETE" });
      toast.success("Fornecedor excluído");
      setDel(null);
      await reload();
    } catch (e) {
      toast.error(msg(e));
    } finally {
      setBusyDel(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-4 flex justify-end">
          <Button onClick={openNovo}>
            <Plus /> Novo fornecedor
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <EmptyRow cols={4} text="A carregar…" />
            ) : fornecedores.length === 0 ? (
              <EmptyRow cols={4} text="Sem fornecedores." />
            ) : (
              fornecedores.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium text-slate-800">
                    {f.nome}
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {f.telefone ?? "—"}
                  </TableCell>
                  <TableCell className="text-slate-500">
                    {f.email ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-3 text-sm">
                      <button
                        onClick={() => openEdit(f)}
                        className="text-brand-600 hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => setDel(f)}
                        className="text-destructive hover:underline"
                      >
                        Excluir
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar fornecedor" : "Novo fornecedor"}
            </DialogTitle>
          </DialogHeader>
          <form id="forn-form" onSubmit={submit} className="space-y-3">
            <div>
              <Label className="mb-1 block">Nome</Label>
              <Input
                autoFocus
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Ex.: TIS - Marketing"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1 block">Telefone</Label>
                <Input
                  value={form.telefone}
                  onChange={(e) =>
                    setForm({ ...form, telefone: e.target.value })
                  }
                />
              </div>
              <div>
                <Label className="mb-1 block">Email</Label>
                <Input
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label className="mb-1 block">Descrição</Label>
              <Input
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                placeholder="Opcional"
              />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" form="forn-form" disabled={saving}>
              {saving ? "A guardar…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDelete
        open={!!del}
        onOpenChange={(v) => !v && setDel(null)}
        onConfirm={confirmDelete}
        title="Excluir fornecedor"
        busy={busyDel}
      >
        Excluir o fornecedor <b>{del?.nome}</b>?
      </ConfirmDelete>
    </Card>
  );
}
