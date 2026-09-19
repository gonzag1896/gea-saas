"use client";

import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { cn } from "@/lib/cn";

type Item = { id: string; nombre: string; rol?: string };

// A partir de esta cantidad conviene un buscador — con pocas ferreterías
// (el caso normal de un usuario con 2-3 membresías) es puro ruido visual.
const UMBRAL_BUSCADOR = 6;

export function SeleccionarFerreteriaForm({ items, modoSoporte }: { items: Item[]; modoSoporte: boolean }) {
  const { update } = useSession();
  const router = useRouter();
  const [enviando, setEnviando] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");

  async function elegir(ferreteriaId: string) {
    setEnviando(ferreteriaId);
    await update(modoSoporte ? { soporteFerreteriaId: ferreteriaId } : { ferreteriaId });
    router.push("/dashboard");
    router.refresh();
  }

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.nombre.toLowerCase().includes(q));
  }, [items, busqueda]);

  if (items.length === 0) {
    return <EmptyState message={`No hay ferreterías ${modoSoporte ? "" : "asignadas a tu usuario "}todavía.`} />;
  }

  return (
    <div className="flex flex-col gap-3">
      {items.length > UMBRAL_BUSCADOR && (
        <Input
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar ferretería…"
          autoFocus
        />
      )}

      <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
        {filtrados.map((item) => (
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
        {filtrados.length === 0 && <p className="px-1 py-2 text-sm text-muted-foreground">Ninguna ferretería coincide con &quot;{busqueda}&quot;.</p>}
      </ul>
    </div>
  );
}
