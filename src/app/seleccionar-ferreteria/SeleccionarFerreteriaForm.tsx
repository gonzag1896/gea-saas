"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";

type Item = { id: string; nombre: string; rol?: string };

export function SeleccionarFerreteriaForm({ items, modoSoporte }: { items: Item[]; modoSoporte: boolean }) {
  const { update } = useSession();
  const router = useRouter();
  const [enviando, setEnviando] = useState<string | null>(null);

  async function elegir(ferreteriaId: string) {
    setEnviando(ferreteriaId);
    await update(modoSoporte ? { soporteFerreteriaId: ferreteriaId } : { ferreteriaId });
    router.push("/dashboard");
    router.refresh();
  }

  if (items.length === 0) {
    return <EmptyState message={`No hay ferreterías ${modoSoporte ? "" : "asignadas a tu usuario "}todavía.`} />;
  }

  return (
    <ul className="flex max-w-sm flex-col gap-2">
      {items.map((item) => (
        <li key={item.id}>
          <button
            onClick={() => elegir(item.id)}
            disabled={enviando !== null}
            className={cn(
              "w-full rounded-md border border-border bg-surface px-4 py-3 text-left text-sm text-foreground transition-colors hover:bg-muted",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {item.nombre}
            {item.rol ? ` — ${item.rol}` : ""}
            {enviando === item.id ? " …" : ""}
          </button>
        </li>
      ))}
    </ul>
  );
}
