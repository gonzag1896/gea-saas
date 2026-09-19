"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { DataTable } from "@/components/ui/DataTable";
import { ActivoBadge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Categoria = { id: string; nombre: string; activo: boolean };

export function CategoriasClient({
  categoriasIniciales,
  puedeCrear,
  puedeEditar,
  puedeEliminar,
}: {
  categoriasIniciales: Categoria[];
  puedeCrear: boolean;
  puedeEditar: boolean;
  puedeEliminar: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [aEliminar, setAEliminar] = useState<Categoria | null>(null);
  const [eliminando, setEliminando] = useState(false);

  // Una vez que router.refresh() trae confirmado el valor que ya
  // adelantamos de forma optimista, el override deja de hacer falta.
  useEffect(() => {
    setOverrides((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const c of categoriasIniciales) {
        if (next[c.id] !== undefined && next[c.id] === c.activo) {
          delete next[c.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [categoriasIniciales]);

  const categorias = categoriasIniciales.map((c) => (overrides[c.id] !== undefined ? { ...c, activo: overrides[c.id] } : c));

  async function reactivar(categoria: Categoria) {
    setOverrides((o) => ({ ...o, [categoria.id]: true }));
    const res = await fetch(`/api/categorias/${categoria.id}`, {
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
    const res = await fetch(`/api/categorias/${aEliminar.id}`, {
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
        title="Categorías"
        action={puedeCrear && (
          <Button onClick={() => router.push("/categorias/nuevo")}>
            <Plus className="h-4 w-4" /> Nueva categoría
          </Button>
        )}
      />

      {error && <Alert>{error}</Alert>}

      <DataTable
        data={categorias}
        rowKey={(c) => c.id}
        searchValue={(c) => c.nombre}
        searchPlaceholder="Buscar categoría…"
        emptyMessage="Todavía no hay categorías cargadas."
        columns={[
          { key: "nombre", header: "Nombre", sortValue: (c) => c.nombre, render: (c) => c.nombre },
          { key: "estado", header: "Estado", sortValue: (c) => Number(c.activo), render: (c) => <ActivoBadge activo={c.activo} /> },
          {
            key: "acciones",
            header: "",
            headClassName: "w-0",
            render: (c) => (
              <div className="flex items-center justify-end gap-1">
                {puedeEditar && (
                  <Button variant="icon" className="h-8 w-8" aria-label={`Editar ${c.nombre}`} onClick={() => router.push(`/categorias/${c.id}/editar`)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {puedeEliminar && c.activo && (
                  <Button variant="icon" className="h-8 w-8 hover:text-danger" aria-label={`Desactivar ${c.nombre}`} onClick={() => setAEliminar(c)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                {puedeEliminar && !c.activo && (
                  <Button variant="icon" className="h-8 w-8 hover:text-success" aria-label={`Reactivar ${c.nombre}`} onClick={() => reactivar(c)}>
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
        title="Desactivar categoría"
        message={aEliminar ? `¿Desactivar "${aEliminar.nombre}"? Vas a poder reactivarla cuando quieras.` : ""}
        confirmLabel="Desactivar"
        variant="danger"
        loading={eliminando}
        onConfirm={confirmarEliminar}
        onCancel={() => setAEliminar(null)}
      />
    </div>
  );
}
