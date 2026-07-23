"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import DatePicker from "@/components/DatePicker";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Cabecalho = {
  assunto: string;
  turma: string;
  local: string;
  data: string; // yyyy-mm-dd (input date)
  periodo: string;
  horaInicio: string; // HH:MM
  horaFim: string; // HH:MM
};

const CABECALHO_INICIAL: Cabecalho = {
  assunto: "",
  turma: "",
  local: "",
  data: "",
  periodo: "Diurno",
  horaInicio: "",
  horaFim: "",
};

// Classes do <Input> shadcn, reutilizadas no DatePicker para manter o mesmo aspeto.
const INPUT_CLS =
  "flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50";

/** yyyy-mm-dd -> dd/mm/yyyy (formato do template). */
function formatarData(v: string): string {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

/** Máscara 24h: insere ":" e limita horas a 0–23 e minutos a 0–59 -> "HH:MM". */
function mascaraHora(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 4);
  if (d.length === 0) return "";
  let hh = d.slice(0, 2);
  if (hh.length === 2) hh = String(Math.min(23, +hh)).padStart(2, "0");
  if (d.length <= 2) return hh;
  let mm = d.slice(2, 4);
  if (mm.length === 2) mm = String(Math.min(59, +mm)).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatarHorario(inicio: string, fim: string): string {
  if (inicio && fim) return `${inicio} – ${fim}`;
  return inicio || fim || "";
}

export default function ListaPresencaForm() {
  const [cab, setCab] = useState<Cabecalho>(CABECALHO_INICIAL);
  const [nomes, setNomes] = useState<string[]>([""]);
  const [linhasEmBranco, setLinhasEmBranco] = useState<number>(0);
  const [gerando, setGerando] = useState(false);
  const nomeRefs = useRef<(HTMLInputElement | null)[]>([]);

  function setCampo<K extends keyof Cabecalho>(k: K, v: Cabecalho[K]) {
    setCab((c) => ({ ...c, [k]: v }));
  }

  function alterarNome(i: number, v: string) {
    setNomes((arr) => arr.map((n, idx) => (idx === i ? v : n)));
  }

  function adicionarNome() {
    setNomes((arr) => [...arr, ""]);
    // foca o novo campo após render
    requestAnimationFrame(() => {
      const el = nomeRefs.current[nomes.length];
      el?.focus();
    });
  }

  function removerNome(i: number) {
    setNomes((arr) => (arr.length === 1 ? [""] : arr.filter((_, idx) => idx !== i)));
  }

  function onEnterNome(e: React.KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (i === nomes.length - 1) adicionarNome();
      else nomeRefs.current[i + 1]?.focus();
    }
  }

  const totalParticipantes = nomes.filter((n) => n.trim() !== "").length;

  async function gerar() {
    if (gerando) return;
    setGerando(true);
    try {
      const payload = {
        assunto: cab.assunto,
        turma: cab.turma,
        local: cab.local,
        data: formatarData(cab.data),
        periodo: cab.periodo,
        horario: formatarHorario(cab.horaInicio, cab.horaFim),
        participantes: nomes,
        linhasEmBranco,
      };

      const res = await fetch("/api/lista-presenca", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error || `Erro ${res.status}`);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const nome = [cab.turma, formatarData(cab.data)]
        .filter(Boolean)
        .join("_")
        .replace(/[^a-zA-Z0-9_]+/g, "_");
      a.href = url;
      a.download = `Lista_Presenca${nome ? "_" + nome : ""}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Lista de Presença gerada.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setGerando(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-navy text-white">
          <FileText className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-navy">Lista de Presença</h2>
          <p className="text-sm text-slate-500">
            Preencha os dados da formação e os nomes dos participantes para gerar
            o documento Word (.docx) pronto a imprimir.
          </p>
        </div>
      </div>

      {/* Dados da formação */}
      <Card>
        <CardHeader>
          <CardTitle>Dados da formação</CardTitle>
          <CardDescription>Aparecem no cabeçalho da lista.</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="mb-1 block">Assunto</Label>
            <Input
              value={cab.assunto}
              onChange={(e) => setCampo("assunto", e.target.value)}
              placeholder="Ex.: Excel Avançado"
            />
          </div>
          <div>
            <Label className="mb-1 block">Turma</Label>
            <Input
              value={cab.turma}
              onChange={(e) => setCampo("turma", e.target.value)}
              placeholder="Ex.: A"
            />
          </div>
          <div>
            <Label className="mb-1 block">Local</Label>
            <Input
              value={cab.local}
              onChange={(e) => setCampo("local", e.target.value)}
              placeholder="Ex.: Transbrás"
            />
          </div>
          <div>
            <Label className="mb-1 block">Data</Label>
            <DatePicker
              value={cab.data}
              onChange={(v) => setCampo("data", v)}
              className={INPUT_CLS}
            />
          </div>
          <div>
            <Label className="mb-1 block">Período</Label>
            <select
              className={INPUT_CLS}
              value={cab.periodo}
              onChange={(e) => setCampo("periodo", e.target.value)}
            >
              <option value="Diurno">Diurno</option>
              <option value="Nocturno">Nocturno</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:col-span-1">
            <div>
              <Label className="mb-1 block">Início</Label>
              <Input
                inputMode="numeric"
                maxLength={5}
                value={cab.horaInicio}
                onChange={(e) => setCampo("horaInicio", mascaraHora(e.target.value))}
                placeholder="08:00"
              />
            </div>
            <div>
              <Label className="mb-1 block">Fim</Label>
              <Input
                inputMode="numeric"
                maxLength={5}
                value={cab.horaFim}
                onChange={(e) => setCampo("horaFim", mascaraHora(e.target.value))}
                placeholder="13:00"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Participantes */}
      <Card>
        <CardHeader>
          <CardTitle>
            Participantes{" "}
            <span className="text-sm font-normal text-slate-400">
              ({totalParticipantes})
            </span>
          </CardTitle>
          <CardDescription>
            Escreva um nome por linha. Chegada, Email, Assinatura e Telefone ficam
            em branco para preenchimento à mão no dia.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {nomes.map((nome, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-7 shrink-0 text-right text-sm tabular-nums text-slate-400">
                {String(i + 1).padStart(2, "0")}
              </span>
              <Input
                ref={(el) => {
                  nomeRefs.current[i] = el;
                }}
                value={nome}
                onChange={(e) => alterarNome(i, e.target.value)}
                onKeyDown={(e) => onEnterNome(e, i)}
                placeholder="Nome do participante"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removerNome(i)}
                aria-label="Remover"
                className="shrink-0 text-slate-400 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={adicionarNome}>
              <Plus className="h-4 w-4" /> Adicionar participante
            </Button>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Label htmlFor="linhasEmBranco" className="whitespace-nowrap">
                Linhas em branco extra
              </Label>
              <Input
                id="linhasEmBranco"
                type="number"
                min={0}
                max={50}
                value={linhasEmBranco}
                onChange={(e) =>
                  setLinhasEmBranco(Math.max(0, Number(e.target.value) || 0))
                }
                className="h-8 w-20"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button
          type="button"
          variant="navy"
          size="lg"
          onClick={gerar}
          disabled={gerando}
        >
          <Download className="h-4 w-4" />
          {gerando ? "A gerar…" : "Gerar Lista de Presença (.docx)"}
        </Button>
      </div>
    </div>
  );
}
