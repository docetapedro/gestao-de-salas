"use client";

import { useEffect } from "react";

/** Modal genérico com overlay, cabeçalho navy e fecho por Esc / clique fora. */
export function Modal({
  title,
  onClose,
  children,
  footer,
  maxWidth = "max-w-md",
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`bg-white rounded-2xl shadow-xl w-full ${maxWidth} overflow-hidden`}
      >
        <div className="bg-navy text-white px-5 py-4 font-bold flex items-center justify-between">
          <span>{title}</span>
          <button
            onClick={onClose}
            aria-label="Fechar"
            className="text-white/70 hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
        {footer && <div className="px-5 pb-5 flex gap-2">{footer}</div>}
      </div>
    </div>
  );
}

/** Diálogo de confirmação (substitui o confirm() nativo). */
export function ConfirmDialog({
  title = "Confirmar",
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}: {
  title?: string;
  message: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      title={title}
      onClose={onCancel}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg bg-slate-100 hover:bg-slate-200 py-2 text-sm font-medium text-slate-700"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`flex-1 rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-60 ${
              danger ? "bg-red-600 hover:bg-red-700" : "bg-navy hover:bg-navy-light"
            }`}
          >
            {busy ? "Aguarde…" : confirmLabel}
          </button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  );
}
