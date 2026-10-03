"use client";

import { useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { filtrarClientes } from "@/lib/buscar-clientes";

type Opcion = { id: string; nombre: string; rut?: string | null };

const MAXIMO_VISIBLE = 50;

// Buscador de clientes: se escribe y la lista se achica al instante (por
// nombre en cualquier orden o por RUT). Flechas para moverse, Enter para
// elegir, Escape para cerrar. Filtra en el navegador sobre la lista ya
// cargada, así que no hay esperas.
export function ClienteAutocomplete({
  clientes,
  seleccionadoId,
  onChange,
  placeholder = "Buscar cliente por nombre o RUT…",
}: {
  clientes: Opcion[];
  seleccionadoId: string;
  onChange: (id: string) => void;
  placeholder?: string;
}) {
  const [texto, setTexto] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(0);
  const listaRef = useRef<HTMLDivElement>(null);

  const seleccionado = clientes.find((c) => c.id === seleccionadoId);
  const coincidencias = useMemo(() => filtrarClientes(clientes, texto), [clientes, texto]);
  const visibles = coincidencias.slice(0, MAXIMO_VISIBLE);

  function abrir() {
    setTexto("");
    setResaltado(0);
    setAbierto(true);
  }

  function elegir(c: Opcion) {
    onChange(c.id);
    setAbierto(false);
    setTexto("");
  }

  function moverA(indice: number) {
    const i = Math.max(0, Math.min(indice, visibles.length - 1));
    setResaltado(i);
    listaRef.current?.children[i]?.scrollIntoView({ block: "nearest" });
  }

  function alTeclear(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!abierto && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      abrir();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moverA(resaltado + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moverA(resaltado - 1);
    } else if (e.key === "Enter" && abierto) {
      e.preventDefault(); // no enviar el formulario de la venta
      if (visibles[resaltado]) elegir(visibles[resaltado]);
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={abierto}
        aria-autocomplete="list"
        value={abierto ? texto : (seleccionado?.nombre ?? "")}
        onChange={(e) => {
          setTexto(e.target.value);
          setResaltado(0);
          setAbierto(true);
        }}
        onFocus={(e) => {
          abrir();
          e.currentTarget.select();
        }}
        onBlur={() => setTimeout(() => setAbierto(false), 150)}
        onKeyDown={alTeclear}
        placeholder={abierto && seleccionado ? seleccionado.nombre : placeholder}
        className={cn(
          "w-full rounded-md border border-border bg-surface py-2 pl-3 pr-9 text-sm text-foreground placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
        )}
      />
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      {abierto && (
        // Más ancho que el campo (que es 1/3 del formulario) para que la razón
        // social se lea entera; en pantallas chicas nunca pasa del ancho visible.
        <div className="absolute z-20 mt-1 w-full min-w-[28rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-md border border-border bg-surface shadow-lg">
          <div ref={listaRef} role="listbox" className="max-h-64 overflow-auto">
            {visibles.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">Ningún cliente coincide. Podés crear uno con “+ Nuevo cliente”.</p>}
            {visibles.map((c, i) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={c.id === seleccionadoId}
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setResaltado(i)}
                onClick={() => elegir(c)}
                className={cn(
                  "flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm",
                  i === resaltado ? "bg-primary/10" : "hover:bg-primary/5",
                  c.id === seleccionadoId && "font-medium",
                )}
              >
                <span className="min-w-0 break-words">{c.nombre}</span>
                {c.rut && <span className="shrink-0 pt-0.5 font-mono text-xs text-muted-foreground">{c.rut}</span>}
              </button>
            ))}
          </div>
          {coincidencias.length > MAXIMO_VISIBLE && (
            <p className="border-t border-border bg-surface px-3 py-1.5 text-xs text-muted-foreground">
              Mostrando {MAXIMO_VISIBLE} de {coincidencias.length}. Seguí escribiendo para acotar.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
