"use client";

import { useEffect, useRef, useState } from "react";

// Datepicker leve com dropdowns de mês e ano (sem dependências externas).
// Trabalha com strings "YYYY-MM-DD" — o mesmo formato de <input type="date">.

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];
const DIAS = ["D", "S", "T", "Q", "Q", "S", "S"]; // Dom..Sáb

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

function parse(value: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value || "");
  if (!match) return null;
  return { y: +match[1], m: +match[2] - 1, d: +match[3] };
}

export default function DatePicker({
  value,
  onChange,
  className = "input",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const parsed = parse(value);
  const hoje = new Date();
  const [viewY, setViewY] = useState(parsed?.y ?? hoje.getFullYear());
  const [viewM, setViewM] = useState(parsed?.m ?? hoje.getMonth());

  // Reposiciona a vista quando o valor muda externamente ou ao abrir.
  useEffect(() => {
    const p = parse(value);
    if (p) {
      setViewY(p.y);
      setViewM(p.m);
    }
  }, [value]);

  // Fecha ao clicar fora.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const base = hoje.getFullYear();
  const anos: number[] = [];
  for (let a = base - 15; a <= base + 10; a++) anos.push(a);
  if (!anos.includes(viewY)) {
    anos.push(viewY);
    anos.sort((a, b) => a - b);
  }

  const primeiroDiaSemana = new Date(viewY, viewM, 1).getDay();
  const diasNoMes = new Date(viewY, viewM + 1, 0).getDate();
  const celulas: (number | null)[] = [];
  for (let i = 0; i < primeiroDiaSemana; i++) celulas.push(null);
  for (let d = 1; d <= diasNoMes; d++) celulas.push(d);

  const display = parsed ? `${pad(parsed.d)}/${pad(parsed.m + 1)}/${parsed.y}` : "";

  return (
    <div className="relative" ref={ref}>
      <input
        type="text"
        readOnly
        className={`${className} cursor-pointer`}
        placeholder="dd/mm/aaaa"
        value={display}
        onClick={() => setOpen((o) => !o)}
      />
      {open && (
        <div className="absolute z-30 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <div className="mb-2 flex gap-1">
            <select
              className="input flex-1 text-sm"
              value={viewM}
              onChange={(e) => setViewM(+e.target.value)}
            >
              {MESES.map((mm, i) => (
                <option key={i} value={i}>
                  {mm}
                </option>
              ))}
            </select>
            <select
              className="input w-24 text-sm"
              value={viewY}
              onChange={(e) => setViewY(+e.target.value)}
            >
              {anos.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[11px] text-slate-400">
            {DIAS.map((d, i) => (
              <div key={i}>{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {celulas.map((d, i) =>
              d === null ? (
                <div key={i} />
              ) : (
                <button
                  type="button"
                  key={i}
                  onClick={() => {
                    onChange(fmt(viewY, viewM, d));
                    setOpen(false);
                  }}
                  className={`rounded py-1 text-sm ${
                    parsed && parsed.d === d && parsed.m === viewM && parsed.y === viewY
                      ? "bg-navy text-white"
                      : "text-slate-700 hover:bg-brand-50"
                  }`}
                >
                  {d}
                </button>
              )
            )}
          </div>
          <div className="mt-2 flex justify-between text-xs">
            <button
              type="button"
              className="text-slate-500 hover:underline"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              Limpar
            </button>
            <button
              type="button"
              className="text-brand-600 hover:underline"
              onClick={() => {
                const t = new Date();
                onChange(fmt(t.getFullYear(), t.getMonth(), t.getDate()));
                setOpen(false);
              }}
            >
              Hoje
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
