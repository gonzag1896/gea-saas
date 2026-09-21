"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, RotateCcw, Wallet, ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Input } from "@/components/ui/Input";
import { ActivoBadge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";

type Cliente = { id: string; nombre: string; telefono: string | null; activo: boolean };
type SortKey = "nombre" | "estado";
type SortDir = "asc" | "desc";
const PAGE_SIZE = 10;

export function ClientesClient({
  clientesIniciales,
  puedeCrear,
  puedeEditar,
  puedeEliminar,
}: {
  clientesIniciales: Cliente[];
  puedeCrear: boolean;
  puedeEditar: boolean;
  puedeEliminar: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [aEliminar, setAEliminar] = useState<Cliente | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("nombre");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    setOverrides((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const c of clientesIniciales) {
        if (next[c.id] !== undefined && next[c.id] === c.activo) {
          delete next[c.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [clientesIniciales]);

  const clientes = clientesIniciales.map((c) => (overrides[c.id] !== undefined ? { ...c, activo: overrides[c.id] } : c));

  const clientesFiltrados = useMemo(() => {
    const filtered = clientes.filter((c) =>
      `${c.nombre} ${c.telefono ?? ""}`.toLowerCase().includes(busqueda.toLowerCase())
    );

    filtered.sort((a, b) => {
      const cmp = sortKey === "nombre"
        ? a.nombre.toLowerCase().localeCompare(b.nombre.toLowerCase())
        : Number(a.activo) - Number(b.activo);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return filtered;
  }, [clientes, busqueda, sortKey, sortDir]);

  const totalPaginas = Math.max(1, Math.ceil(clientesFiltrados.length / PAGE_SIZE));
  const paginaActual = Math.min(page, totalPaginas);
  const clientesPagina = clientesFiltrados.slice((paginaActual - 1) * PAGE_SIZE, paginaActual * PAGE_SIZE);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

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

  async function reactivar(cliente: Cliente) {
    setOverrides((o) => ({ ...o, [cliente.id]: true }));
    const res = await fetch(`/api/clientes/${cliente.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: true }),
    });
    if (!res.ok) setError((await res.json()).error);
    router.refresh();
  }

  async function confirmarEliminar() {
    if (!aEliminar) return;
    setEliminando(true);
    const res = await fetch(`/api/clientes/${aEliminar.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: false }),
    });
    setEliminando(false);
    if (!res.ok) {
      setError((await res.json()).error);
      setAEliminar(null);
      return;
    }
    setOverrides((o) => ({ ...o, [aEliminar.id]: false }));
    setAEliminar(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clientes"
        action={puedeCrear && (
          <Button onClick={() => router.push("/clientes/nuevo")}>
            <Plus className="h-4 w-4" /> Nuevo cliente
          </Button>
        )}
      />

      {error && <Alert>{error}</Alert>}

      <div className="flex items-center gap-4">
        <Input
          type="search"
          placeholder="Buscar cliente…"
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
          className="max-w-sm"
        />
        <p className="text-sm text-muted-foreground">
          {clientesFiltrados.length} de {clientes.length} clientes
        </p>
      </div>

      {clientesFiltrados.length === 0 ? (
        <EmptyState message={busqueda ? "No hay clientes que coincidan con la búsqueda." : "Todavía no hay clientes cargados."} />
      ) : (
        <>
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full table-fixed">
              <colgroup>
                <col style={{ width: "45%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "35%" }} />
              </colgroup>
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <SortHeader label="Cliente" sortBy="nombre" />
                  </th>
                  <th className="px-4 py-3 text-center">
                    <div className="flex items-center justify-center">
                      <SortHeader label="Estado" sortBy="estado" />
                    </div>
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold text-foreground">
                    Acciones
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {clientesPagina.map((cliente) => (
                  <tr
                    key={cliente.id}
                    className="hover:bg-blue-50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/clientes/${cliente.id}`)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground truncate">{cliente.nombre}</p>
                      {cliente.telefono && (
                        <p className="text-xs text-muted-foreground mt-0.5">{cliente.telefono}</p>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center">
                        <ActivoBadge activo={cliente.activo} />
                      </div>
                    </td>

                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip label="Cuenta corriente" side="left">
                          <Button
                            variant="icon"
                            className="h-8 w-8"
                            aria-label={`Cuenta corriente de ${cliente.nombre}`}
                            onClick={() => router.push(`/clientes/${cliente.id}`)}
                          >
                            <Wallet className="h-4 w-4" />
                          </Button>
                        </Tooltip>
                        {puedeEditar && (
                          <Tooltip label="Editar" side="left">
                            <Button
                              variant="icon"
                              className="h-8 w-8"
                              aria-label={`Editar ${cliente.nombre}`}
                              onClick={() => router.push(`/clientes/${cliente.id}/editar`)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                          </Tooltip>
                        )}
                        {puedeEliminar && cliente.activo && (
                          <Tooltip label="Desactivar" side="left">
                            <Button
                              variant="icon"
                              className="h-8 w-8 hover:text-danger"
                              aria-label={`Desactivar ${cliente.nombre}`}
                              onClick={() => setAEliminar(cliente)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </Tooltip>
                        )}
                        {puedeEliminar && !cliente.activo && (
                          <Tooltip label="Reactivar" side="left">
                            <Button
                              variant="icon"
                              className="h-8 w-8 hover:text-success"
                              aria-label={`Reactivar ${cliente.nombre}`}
                              onClick={() => reactivar(cliente)}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          </Tooltip>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPaginas > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Página {paginaActual} de {totalPaginas} · {clientesFiltrados.length} resultados</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={paginaActual === 1}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPaginas, p + 1))} disabled={paginaActual === totalPaginas}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={aEliminar !== null}
        title="Desactivar cliente"
        message={aEliminar ? `¿Desactivar "${aEliminar.nombre}"? Vas a poder reactivarlo cuando quieras.` : ""}
        confirmLabel="Desactivar"
        variant="danger"
        loading={eliminando}
        onConfirm={confirmarEliminar}
        onCancel={() => setAEliminar(null)}
      />
    </div>
  );
}
