"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";

export type ProductoOpcion = {
  id: string;
  codigo: string;
  codigoBarras: string | null;
  descripcion: string;
  moneda: "UYU" | "USD";
  precioVenta: string;
  precioDeLista?: boolean;
  stockActual: number;
};

// Buscador de productos por código o nombre, con el stock a la vista.
// Consulta al servidor mientras se escribe (con una pequeña espera para no
// pegarle en cada tecla): el catálogo puede tener miles de productos y ya
// no se manda entero al navegador.
export function ProductoAutocomplete({
  seleccionado,
  onChange,
  listaPrecioId,
  placeholder = "Buscar por código o nombre…",
}: {
  seleccionado: ProductoOpcion | null;
  onChange: (producto: ProductoOpcion) => void;
  listaPrecioId?: string | null;
  placeholder?: string;
}) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [resultados, setResultados] = useState<ProductoOpcion[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [falloBusqueda, setFalloBusqueda] = useState(false);
  const [creandoRapido, setCreandoRapido] = useState(false);
  const [errorRapido, setErrorRapido] = useState<string | null>(null);

  useEffect(() => {
    if (!abierto) return;
    const controlador = new AbortController();
    const espera = setTimeout(async () => {
      setBuscando(true);
      setFalloBusqueda(false);
      try {
        const params = new URLSearchParams({ q: texto });
        if (listaPrecioId) params.set("listaPrecioId", listaPrecioId);
        const res = await fetch(`/api/productos/buscar?${params}`, { signal: controlador.signal });
        if (!res.ok) throw new Error();
        setResultados((await res.json()).productos);
        setBuscando(false);
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
        setFalloBusqueda(true);
        setBuscando(false);
      }
    }, texto ? 250 : 0);
    return () => {
      clearTimeout(espera);
      controlador.abort();
    };
  }, [texto, abierto, listaPrecioId]);

  function elegir(p: ProductoOpcion) {
    onChange(p);
    setTexto("");
    setAbierto(false);
    setErrorRapido(null);
  }

  // No está en el catálogo: se da de alta con solo el nombre, "pendiente
  // de clasificar" (mismo criterio que la carga inicial del catálogo), y
  // queda elegido en el momento — no frena la venta/compra. Alguien con
  // permiso de Productos completa la ficha (categoría, marca, precio,
  // código de barras) después.
  async function crearRapido() {
    const nombre = texto.trim();
    if (!nombre) return;
    setCreandoRapido(true);
    setErrorRapido(null);
    try {
      const res = await fetch("/api/productos/rapido", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ descripcion: nombre }),
      });
      if (!res.ok) {
        setErrorRapido((await res.json().catch(() => null))?.error ?? "No se pudo crear el producto.");
        return;
      }
      const { producto } = await res.json();
      elegir(producto);
    } catch {
      setErrorRapido("No se pudo crear el producto.");
    } finally {
      setCreandoRapido(false);
    }
  }

  return (
    <div className="relative">
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
          {falloBusqueda && <p className="px-3 py-2 text-sm text-danger">No se pudo buscar. Probá de nuevo.</p>}
          {!falloBusqueda && buscando && resultados.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Buscando…</p>}
          {!falloBusqueda && !buscando && resultados.length === 0 && texto.trim() === "" && (
            <p className="px-3 py-2 text-sm text-muted-foreground">Sin resultados.</p>
          )}
          {resultados.map((p) => (
            <button
              key={p.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => elegir(p)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-primary/10"
            >
              <span className="truncate">{p.codigo} — {p.descripcion}</span>
              <span className={cn("shrink-0 font-mono text-xs tabular-nums", p.stockActual <= 0 ? "text-danger" : "text-muted-foreground")}>
                Stock: {p.stockActual}
              </span>
            </button>
          ))}
          {!buscando && texto.trim() !== "" && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={crearRapido}
              disabled={creandoRapido}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary hover:bg-primary/10 disabled:opacity-60",
                resultados.length > 0 && "border-t border-border",
              )}
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">
                {creandoRapido ? "Creando…" : <>Producto nuevo: <span className="font-medium">“{texto.trim()}”</span></>}
              </span>
            </button>
          )}
          {errorRapido && <p className="px-3 py-2 text-sm text-danger">{errorRapido}</p>}
        </div>
      )}
    </div>
  );
}
