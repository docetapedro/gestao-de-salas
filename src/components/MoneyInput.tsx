"use client";

import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/** Converte o valor canónico ("1234.5") para display AOA ("1.234,5"). */
export function moneyToDisplay(canonical: string): string {
  if (canonical === "" || canonical == null) return "";
  const [int, dec] = String(canonical).split(".");
  const grouped = (int || "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return dec != null ? `${grouped},${dec}` : grouped;
}

/**
 * Campo monetário com formatação de milhares "." e decimal "," (AOA).
 * `value`/`onChange` usam a forma canónica ("1234.5"). `prefix` (default "AOA")
 * mostra o rótulo à esquerda; passa `null` para o esconder.
 */
export function MoneyInput({
  value,
  onChange,
  prefix = "AOA",
  className,
}: {
  value: string;
  onChange: (raw: string) => void;
  prefix?: string | null;
  className?: string;
}) {
  const [text, setText] = useState(() => moneyToDisplay(value));

  // Mantém o display em sincronia se o valor externo mudar (ex.: reset/editar).
  useEffect(() => {
    const parsed = text.replace(/\./g, "").replace(",", ".");
    const current = parsed === "" || parsed === "." ? "" : parsed;
    if (current !== value) setText(moneyToDisplay(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handle(e: React.ChangeEvent<HTMLInputElement>) {
    const t = e.target.value.replace(/[^\d.,]/g, "");
    // "." é separador de milhares → ignora; "," é o decimal.
    const parts = t.replace(/\./g, "").split(",");
    const intPart = parts[0] || "";
    const decPart = parts.length > 1 ? parts.slice(1).join("").slice(0, 2) : null;
    const grouped = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    setText(decPart === null ? grouped : `${grouped},${decPart}`);
    const canonical =
      intPart === "" && decPart === null
        ? ""
        : `${intPart || "0"}${decPart !== null ? "." + decPart : ""}`;
    onChange(canonical);
  }

  return (
    <div className="relative">
      {prefix && (
        <span className="pointer-events-none absolute left-2 top-1/2 z-10 -translate-y-1/2 text-xs text-slate-400">
          {prefix}
        </span>
      )}
      <Input
        className={cn("text-right", className)}
        inputMode="decimal"
        placeholder="0,00"
        value={text}
        onChange={handle}
        style={prefix ? { paddingLeft: "2.5rem" } : undefined}
      />
    </div>
  );
}
