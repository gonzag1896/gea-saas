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

type SubCategoria = { id: string; nombre: string; activo: boolean; categoriaId: string; categoria: { nombre: string } };

export function SubCategoriasClient({
  subCategoriasIniciales,
  puedeCrear,
  puedeEditar,
  puedeEliminar,
}: {
  subCategoriasIniciales: SubCategoria[];
  puedeCrear: boolean;
  puedeEditar: boolean;
  puedeEliminar: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [aEliminar, setAEliminar] = useState<SubCategoria | null>(null);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    setOverrides((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const s of subCategoriasIniciales) {
        if (next[s.id] !== undefined && next[s.id] === s.activo) {
          delete next[s.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [subCategoriasIniciales]);

  const subCategorias = subCategoriasIniciales.map((s) => (overrides[s.id] !== undefined ? { ...s, activo: overrides[s.id] } : s));

  async function reactivar(sub: SubCategoria) {
    setOverrides((o) => ({ ...o, [sub.id]: true }));
    const res = await fetch(`/api/subcategorias/${sub.id}`, {
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
    const res = await fetch(`/api/subcategorias/${aEliminar.id}`, {
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
        title="Familias"
        action={puedeCrear && (
          <Button onClick={() => router.push("/sub-categorias/nuevo")}>
            <Plus className="h-4 w-4" /> Nueva familia
          </Button>
        )}
      />

      {error && <Alert>{error}</Alert>}

      <DataTable
        data={subCategorias}
        rowKey={(s) => s.id}
        searchValue={(s) => `${s.nombre} ${s.categoria.nombre}`}
        searchPlaceholder="Buscar familia…"
        emptyMessage="Todavía no hay familias cargadas."
        columns={[
          { key: "nombre", header: "Nombre", sortValue: (s) => s.nombre, render: (s) => s.nombre },
          { key: "categoria", header: "Categoría", sortValue: (s) => s.categoria.nombre, render: (s) => s.categoria.nombre },
          { key: "estado", header: "Estado", sortValue: (s) => Number(s.activo), render: (s) => <ActivoBadge activo={s.activo} /> },
          {
            key: "acciones",
            header: "",
            headClassName: "w-0",
            render: (s) => (
              <div className="flex items-center justify-end gap-1">
                {puedeEditar && (
                  <Button variant="icon" className="h-8 w-8" aria-label={`Editar ${s.nombre}`} onClick={() => router.push(`/sub-categorias/${s.id}/editar`)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {puedeEliminar && s.activo && (
                  <Button variant="icon" className="h-8 w-8 hover:text-danger" aria-label={`Desactivar ${s.nombre}`} onClick={() => setAEliminar(s)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                {puedeEliminar && !s.activo && (
                  <Button variant="icon" className="h-8 w-8 hover:text-success" aria-label={`Reactivar ${s.nombre}`} onClick={() => reactivar(s)}>
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
        title="Desactivar familia"
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
