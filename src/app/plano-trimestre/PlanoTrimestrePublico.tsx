"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  VisaoTrimestral,
  type PFFormacao,
} from "@/app/(app)/plano-formativo/VisaoTrimestral";

type Payload = { ano: number | null; anos: number[]; formacoes: PFFormacao[] };

export default function PlanoTrimestrePublico() {
  const searchParams = useSearchParams();
  const anoUrl = searchParams.get("ano");
  const [ano, setAno] = useState<number | null>(anoUrl ? Number(anoUrl) : null);
  const [data, setData] = useState<Payload | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let vivo = true;
    setLoading(true);
    api<Payload>(
      `/api/public/plano-formativo${ano ? `?ano=${ano}` : ""}`,
      { cache: "no-store" }
    )
      .then((d) => {
        if (!vivo) return;
        setData(d);
        setAno(d.ano);
        setErro(null);
      })
      .catch((e) => vivo && setErro((e as Error).message))
      .finally(() => vivo && setLoading(false));
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano]);

  if (loading && !data)
    return <div className="py-16 text-center text-slate-400">A carregar…</div>;
  if (erro)
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
        {erro}
      </div>
    );
  if (!data || data.ano === null)
    return (
      <div className="py-16 text-center text-slate-400">
        Ainda não há plano formativo publicado.
      </div>
    );

  return (
    <div className="space-y-4">
      {data.anos.length > 1 && (
        <div className="flex items-center gap-2">
          <Label className="text-sm text-slate-500">Ano do plano</Label>
          <Select value={String(data.ano)} onValueChange={(v) => setAno(Number(v))}>
            <SelectTrigger className="w-[120px] font-semibold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {data.anos.map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <VisaoTrimestral formacoes={data.formacoes} ano={data.ano} />
    </div>
  );
}
