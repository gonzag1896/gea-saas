"use client";

import { useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export type ProductoOpcion = { id: string; codigo?: string; descripcion?: string; stockActual?: number };

// Buscador de productos por código o nombre, con el stock a la vista, para
// reemplazar el <select> plano en Compras/Ventas — con decenas de
// productos ya es más rápido tipear que scrollear un combo nativo.
export function ProductoAutocomplete({
  productos,
  value,
  onChange,
  placeholder = "Buscar por código o nombre…",
}: {
  productos: ProductoOpcion[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const seleccionado = productos.find((p) => p.id === value);
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement>(null);

  const resultados = useMemo(() => {
    const q = texto.trim().toLowerCase();
    if (!q) return productos.slice(0, 30);
    return productos
      .filter((p) => p.codigo?.toLowerCase().includes(q) || p.descripcion?.toLowerCase().includes(q))
      .slice(0, 30);
  }, [productos, texto]);

  function elegir(p: ProductoOpcion) {
    onChange(p.id);
    setTexto("");
    setAbierto(false);
  }

  return (
    <div ref={contenedorRef} className="relative">
      <input
        type="text"
        value={abierto ? texto : seleccionado ? `${seleccionado.codigo} — ${seleccionado.descripcion}` : ""}
        onChange={(e) => {
          setTexto(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => {
          setTexto("");
          setAbierto(true);
        }}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        placeholder={placeholder}
        className={cn(
          "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
        )}
      />
      {abierto && (
        <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-md border border-border bg-surface shadow-lg">
          {resultados.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados.</p>}
          {resultados.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => elegir(p)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-primary/10"
            >
              <span className="truncate">{p.codigo} — {p.descripcion}</span>
              {p.stockActual !== undefined && (
                <span className={cn("shrink-0 font-mono text-xs tabular-nums", p.stockActual <= 0 ? "text-danger" : "text-muted-foreground")}>
                  Stock: {p.stockActual}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
