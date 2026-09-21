"use client";

import { useState, useMemo } from "react";
import { TrendingUp, TrendingDown, ArrowUpDown } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Input } from "@/components/ui/Input";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";

type ProveedorConSaldo = { id: string; nombre: string; telefono: string | null; saldo: number };
type SortKey = "nombre" | "saldo";
type SortDir = "asc" | "desc";

export function CuentaCorrienteProveedoresClient({ proveedores }: { proveedores: ProveedorConSaldo[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("nombre");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const proveedoresFiltrados = useMemo(() => {
    let filtered = proveedores.filter(p =>
      `${p.nombre} ${p.telefono ?? ""}`.toLowerCase().includes(busqueda.toLowerCase())
    );

    filtered.sort((a, b) => {
      let aVal: any, bVal: any;
      if (sortKey === "nombre") {
        aVal = a.nombre.toLowerCase();
        bVal = b.nombre.toLowerCase();
      } else {
        aVal = a.saldo;
        bVal = b.saldo;
      }

      const result = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === "asc" ? result : -result;
    });

    return filtered;
  }, [proveedores, busqueda, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const SortHeader = ({ label, sortBy }: { label: string; sortBy: SortKey }) => (
    <button
      onClick={() => toggleSort(sortBy)}
      className="flex items-center gap-2 font-semibold text-foreground hover:text-blue-600 transition-colors"
    >
      {label}
      {sortKey === sortBy && (
        <ArrowUpDown className={cn("h-4 w-4", sortDir === "desc" && "rotate-180")} />
      )}
    </button>
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Cuenta Corriente - Proveedores" />

      {/* Búsqueda */}
      <div className="flex items-center gap-4">
        <Input
          type="search"
          placeholder="Buscar proveedor…"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="max-w-sm"
        />
        <p className="text-sm text-muted-foreground">
          {proveedoresFiltrados.length} de {proveedores.length} proveedores
        </p>
      </div>

      {/* Tabla moderna */}
      {proveedoresFiltrados.length === 0 ? (
        <EmptyState message={busqueda ? "No hay proveedores que coincidan con la búsqueda." : "Todavía no hay proveedores cargados."} />
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full table-fixed">
            <colgroup>
              <col style={{ width: "50%" }} />
              <col style={{ width: "28%" }} />
              <col style={{ width: "22%" }} />
            </colgroup>
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left">
                  <SortHeader label="Proveedor" sortBy="nombre" />
                </th>
                <th className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end">
                    <SortHeader label="Saldo" sortBy="saldo" />
                  </div>
                </th>
                <th className="px-4 py-3 text-center text-sm font-semibold text-foreground">
                  Estado
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200">
              {proveedoresFiltrados.map((proveedor) => {
                const esDeuda = proveedor.saldo > 0;

                return (
                  <tr
                    key={proveedor.id}
                    className="hover:bg-blue-50 transition-colors cursor-pointer"
                    onClick={() => window.location.href = `/proveedores/${proveedor.id}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground truncate">{proveedor.nombre}</p>
                      {proveedor.telefono && (
                        <p className="text-xs text-muted-foreground mt-0.5">{proveedor.telefono}</p>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <span className={cn(
                          "font-bold font-mono tabular-nums",
                          esDeuda ? "text-red-600" : "text-green-600"
                        )}>
                          ${Math.abs(proveedor.saldo).toFixed(2)}
                        </span>
                        {esDeuda
                          ? <TrendingUp className="h-4 w-4 text-red-500 flex-shrink-0" />
                          : <TrendingDown className="h-4 w-4 text-green-500 flex-shrink-0" />
                        }
                      </div>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap",
                          esDeuda ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"
                        )}>
                          {esDeuda ? "A pagar" : "A favor"}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
