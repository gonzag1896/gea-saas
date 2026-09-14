"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Card } from "./Card";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

// Primitiva de diálogo del Design System — reemplaza window.prompt()/
// window.confirm(), que no son componentes y no se pueden estilar.
// Portal a document.body (sin librería extra) + cierre con Escape.
export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-md shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 text-base font-semibold text-foreground">{title}</h2>
        <div className="text-sm text-foreground">{children}</div>
        {footer && <div className="mt-4 flex justify-end gap-2">{footer}</div>}
      </Card>
    </div>,
    document.body,
  );
}
