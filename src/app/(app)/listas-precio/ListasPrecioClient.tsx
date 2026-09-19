"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, RotateCcw, ListOrdered } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { DataTable } from "@/components/ui/DataTable";
import { ActivoBadge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type ListaPrecio = { id: string; nombre: string; activo: boolean };

export function ListasPrecioClient({
  listasIniciales,
  puedeCrear,
  puedeEditar,
  puedeEliminar,
}: {
  listasIniciales: ListaPrecio[];
  puedeCrear: boolean;
  puedeEditar: boolean;
  puedeEliminar: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [aEliminar, setAEliminar] = useState<ListaPrecio | null>(null);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    setOverrides((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const l of listasIniciales) {
        if (next[l.id] !== undefined && next[l.id] === l.activo) {
          delete next[l.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [listasIniciales]);

  const listas = listasIniciales.map((l) => (overrides[l.id] !== undefined ? { ...l, activo: overrides[l.id] } : l));

  async function reactivar(lista: ListaPrecio) {
    setOverrides((o) => ({ ...o, [lista.id]: true }));
    const res = await fetch(`/api/listas-precio/${lista.id}`, {
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
    const res = await fetch(`/api/listas-precio/${aEliminar.id}`, {
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
        title="Listas de Precio"
        description="Precios alternativos por producto (ej. Mayorista) — se cargan desde la ficha de cada producto y se asignan a un cliente para que Ventas sugiera ese precio."
        action={puedeCrear && (
          <Button onClick={() => router.push("/listas-precio/nuevo")}>
            <Plus className="h-4 w-4" /> Nueva lista de precio
          </Button>
        )}
      />

      {error && <Alert>{error}</Alert>}

      <DataTable
        data={listas}
        rowKey={(l) => l.id}
        searchValue={(l) => l.nombre}
        searchPlaceholder="Buscar lista de precio…"
        emptyMessage="Todavía no hay listas de precio cargadas."
        columns={[
          { key: "nombre", header: "Nombre", sortValue: (l) => l.nombre, render: (l) => l.nombre },
          { key: "estado", header: "Estado", sortValue: (l) => Number(l.activo), render: (l) => <ActivoBadge activo={l.activo} /> },
          {
            key: "acciones",
            header: "",
            headClassName: "w-0",
            render: (l) => (
              <div className="flex items-center justify-end gap-1">
                <Button variant="icon" className="h-8 w-8" aria-label={`Ver detalle de ${l.nombre}`} onClick={() => router.push(`/listas-precio/${l.id}`)}>
                  <ListOrdered className="h-4 w-4" />
                </Button>
                {puedeEditar && (
                  <Button variant="icon" className="h-8 w-8" aria-label={`Editar ${l.nombre}`} onClick={() => router.push(`/listas-precio/${l.id}/editar`)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {puedeEliminar && l.activo && (
                  <Button variant="icon" className="h-8 w-8 hover:text-danger" aria-label={`Desactivar ${l.nombre}`} onClick={() => setAEliminar(l)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                {puedeEliminar && !l.activo && (
                  <Button variant="icon" className="h-8 w-8 hover:text-success" aria-label={`Reactivar ${l.nombre}`} onClick={() => reactivar(l)}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ),
          },
        ]}
      />

      <ConfirmDialog
        open={aEliminar !== null}
        title="Desactivar lista de precio"
        message={aEliminar ? `¿Desactivar "${aEliminar.nombre}"? Los clientes asignados van a ver el precio base hasta que la reactives.` : ""}
        confirmLabel="Desactivar"
        variant="danger"
        loading={eliminando}
        onConfirm={confirmarEliminar}
        onCancel={() => setAEliminar(null)}
      />
    </div>
  );
}
