"use client";

import { useEffect, useRef } from "react";

/**
 * Corre `fn` de imediato e depois a cada `intervalMs`, mas SÓ enquanto o
 * separador está visível. Ao esconder/fechar o separador, pára — assim os
 * ecrãs esquecidos abertos deixam de consultar a base de dados. É retomado
 * automaticamente quando o separador volta a ficar visível.
 */
export function useLivePoll(
  fn: () => void,
  intervalMs: number,
  opts: { enabled?: boolean } = {}
) {
  const { enabled = true } = opts;
  const saved = useRef(fn);
  saved.current = fn;

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const tick = () => {
      if (document.visibilityState === "visible") saved.current();
    };

    const arrancar = () => {
      if (timer) return;
      tick(); // corre já ao ficar visível
      timer = setInterval(tick, intervalMs);
    };

    const parar = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const onVisibilidade = () =>
      document.visibilityState === "visible" ? arrancar() : parar();

    document.addEventListener("visibilitychange", onVisibilidade);
    if (document.visibilityState === "visible") arrancar();

    return () => {
      document.removeEventListener("visibilitychange", onVisibilidade);
      parar();
    };
  }, [intervalMs, enabled]);
}
