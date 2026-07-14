"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ChevronLeft, ChevronRight, Plus, Search } from "lucide-react";

type Projeto = {
  id: string;
  codigo: string | null;
  nome: string;
  segmentoMercado: string | null;
  cliente: { nome: string } | null;
  modalidade: string | null;
  dataInicio: string | null;
  pilar: { nome: string } | null;
  local: { name: string } | null;
  inscritos: number;
};

const PAGE_SIZE = 10;
const TODOS = "__todos__";

export default function ProjetosPage() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [busca, setBusca] = useState("");
  const [cliente, setCliente] = useState(TODOS);
  const [modalidade, setModalidade] = useState(TODOS);
  const [pagina, setPagina] = useState(1);

  useEffect(() => {
    api<{ projetos: Projeto[] }>("/api/projetos")
      .then((d) => setProjetos(d.projetos))
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  // Listas distintas para os selects de filtro.
  const clientes = useMemo(
    () =>
      [...new Set(projetos.map((p) => p.cliente?.nome).filter(Boolean))].sort() as string[],
    [projetos]
  );
  const modalidades = useMemo(
    () =>
      [...new Set(projetos.map((p) => p.modalidade).filter(Boolean))].sort() as string[],
    [projetos]
  );

  // Aplica filtros.
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return projetos.filter((p) => {
      if (cliente !== TODOS && p.cliente?.nome !== cliente) return false;
      if (modalidade !== TODOS && p.modalidade !== modalidade) return false;
      if (
        q &&
        !p.nome.toLowerCase().includes(q) &&
        !(p.codigo || "").toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [projetos, busca, cliente, modalidade]);

  // Sempre que os filtros mudam, volta à primeira página.
  useEffect(() => {
    setPagina(1);
  }, [busca, cliente, modalidade]);

  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicio = (paginaAtual - 1) * PAGE_SIZE;
  const visiveis = filtrados.slice(inicio, inicio + PAGE_SIZE);

  const temFiltros =
    busca.trim() !== "" || cliente !== TODOS || modalidade !== TODOS;

  function limparFiltros() {
    setBusca("");
    setCliente(TODOS);
    setModalidade(TODOS);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Projectos</h1>
          <p className="text-sm text-muted-foreground">
            Formações e o respectivo relatório One-Page de indicadores.
          </p>
        </div>
        <Button asChild variant="navy">
          <Link href="/projetos/novo">
            <Plus />
            Novo projecto
          </Link>
        </Button>
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-200">
          {error}
        </div>
      )}

      {/* Filtros */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[14rem] flex-1">
            <Label className="mb-1 block">Pesquisar</Label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-8"
                placeholder="Nome ou código do projecto"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
              />
            </div>
          </div>
          <div className="w-48">
            <Label className="mb-1 block">Cliente</Label>
            <Select value={cliente} onValueChange={setCliente}>
              <SelectTrigger>
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todos os clientes</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="w-44">
            <Label className="mb-1 block">Modalidade</Label>
            <Select value={modalidade} onValueChange={setModalidade}>
              <SelectTrigger>
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODOS}>Todas</SelectItem>
                {modalidades.map((m) => (
                  <SelectItem key={m} value={m}>
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {temFiltros && (
            <Button variant="ghost" onClick={limparFiltros}>
              Limpar
            </Button>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Carregando…</div>
        ) : projetos.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            Nenhum projecto ainda.{" "}
            <Link
              href="/projetos/novo"
              className="text-brand-600 hover:underline"
            >
              Criar o primeiro
            </Link>
            .
          </div>
        ) : (
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Formação</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Modalidade</TableHead>
                  <TableHead className="text-right">Inscritos</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiveis.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      {p.codigo ? (
                        <Badge variant="secondary" className="font-mono">
                          {p.codigo}
                        </Badge>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/projetos/${p.id}`}
                        className="font-medium text-slate-800 hover:text-brand-700"
                      >
                        {p.nome}
                      </Link>
                      <div className="mt-0.5 text-xs text-slate-400">
                        {p.segmentoMercado || p.pilar?.nome || "—"}
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {p.cliente?.nome || "—"}
                    </TableCell>
                    <TableCell className="text-slate-600">
                      {p.modalidade || "—"}
                    </TableCell>
                    <TableCell className="text-right text-slate-600">
                      {p.inscritos}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <Button asChild variant="link" size="sm">
                        <Link href={`/projetos/${p.id}`}>Relatório</Link>
                      </Button>
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/projetos/${p.id}/editar`}>Editar</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {visiveis.length === 0 && (
                  <TableRow className="hover:bg-transparent">
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-slate-400"
                    >
                      Nenhum projecto corresponde aos filtros.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>

            {/* Paginação */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-sm text-muted-foreground">
              <span>
                {filtrados.length === 0
                  ? "0 projectos"
                  : `Mostrando ${inicio + 1}–${Math.min(
                      inicio + PAGE_SIZE,
                      filtrados.length
                    )} de ${filtrados.length}`}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={paginaAtual <= 1}
                  onClick={() => setPagina((n) => Math.max(1, n - 1))}
                >
                  <ChevronLeft /> Anterior
                </Button>
                <span className="px-1">
                  Página {paginaAtual} de {totalPaginas}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={paginaAtual >= totalPaginas}
                  onClick={() =>
                    setPagina((n) => Math.min(totalPaginas, n + 1))
                  }
                >
                  Próximo <ChevronRight />
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  );
}
