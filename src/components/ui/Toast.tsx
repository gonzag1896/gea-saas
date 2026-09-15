"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/cn";

type ToastVariant = "success" | "error" | "info";
type ToastInput = { title: string; description?: string; variant?: ToastVariant };
type ToastItem = ToastInput & { id: number };

const ToastContext = createContext<((toast: ToastInput) => void) | null>(null);

const ICONS: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};
const ICON_CLASSES: Record<ToastVariant, string> = {
  success: "text-success",
  error: "text-danger",
  info: "text-primary",
};

let nextId = 1;

// Notificaciones globales de la app — reemplazo del feedback silencioso
// (o solo un <Alert> en la propia pantalla) para acciones que conviene
// confirmar aunque el usuario ya haya navegado a otro lado.
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  // El portal solo puede montarse después de hidratar: en el servidor
  // `document` no existe, y si el chequeo se hace en el propio render
  // (en vez de en un efecto) el primer render del cliente difiere del
  // HTML del servidor y React tira un error de hidratación.
  const [montado, setMontado] = useState(false);
  useEffect(() => setMontado(true), []);

  const push = useCallback((input: ToastInput) => {
    const id = nextId++;
    setToasts((t) => [...t, { ...input, id }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  function dismiss(id: number) {
    setToasts((t) => t.filter((x) => x.id !== id));
  }

  return (
    <ToastContext.Provider value={push}>
      {children}
      {montado &&
        createPortal(
          <div className="fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
            {toasts.map((t) => {
              const Icon = ICONS[t.variant ?? "info"];
              return (
                <div
                  key={t.id}
                  role="status"
                  className="flex items-start gap-3 rounded-md border border-border bg-surface p-3 shadow-popover"
                >
                  <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", ICON_CLASSES[t.variant ?? "info"])} />
                  <div className="flex-1 text-sm">
                    <p className="font-medium text-foreground">{t.title}</p>
                    {t.description && <p className="mt-0.5 text-muted-foreground">{t.description}</p>}
                  </div>
                  <button type="button" onClick={() => dismiss(t.id)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de ToastProvider.");
  return ctx;
}
