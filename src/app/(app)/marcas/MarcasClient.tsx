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

type Marca = { id: string; nombre: string; activo: boolean };

export function MarcasClient({
  marcasIniciales,
  puedeCrear,
  puedeEditar,
  puedeEliminar,
}: {
  marcasIniciales: Marca[];
  puedeCrear: boolean;
  puedeEditar: boolean;
  puedeEliminar: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [aEliminar, setAEliminar] = useState<Marca | null>(null);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    setOverrides((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const m of marcasIniciales) {
        if (next[m.id] !== undefined && next[m.id] === m.activo) {
          delete next[m.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [marcasIniciales]);

  const marcas = marcasIniciales.map((m) => (overrides[m.id] !== undefined ? { ...m, activo: overrides[m.id] } : m));

  async function reactivar(marca: Marca) {
    setOverrides((o) => ({ ...o, [marca.id]: true }));
    const res = await fetch(`/api/marcas/${marca.id}`, {
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
    const res = await fetch(`/api/marcas/${aEliminar.id}`, {
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
        title="Marcas"
        action={puedeCrear && (
          <Button onClick={() => router.push("/marcas/nuevo")}>
            <Plus className="h-4 w-4" /> Nueva marca
          </Button>
        )}
      />

      {error && <Alert>{error}</Alert>}

      <DataTable
        data={marcas}
        rowKey={(m) => m.id}
        searchValue={(m) => m.nombre}
        searchPlaceholder="Buscar marca…"
        emptyMessage="Todavía no hay marcas cargadas."
        columns={[
          { key: "nombre", header: "Nombre", sortValue: (m) => m.nombre, render: (m) => m.nombre },
          { key: "estado", header: "Estado", sortValue: (m) => Number(m.activo), render: (m) => <ActivoBadge activo={m.activo} /> },
          {
            key: "acciones",
            header: "",
            headClassName: "w-0",
            render: (m) => (
              <div className="flex items-center justify-end gap-1">
                {puedeEditar && (
                  <Button variant="icon" className="h-8 w-8" aria-label={`Editar ${m.nombre}`} onClick={() => router.push(`/marcas/${m.id}/editar`)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {puedeEliminar && m.activo && (
                  <Button variant="icon" className="h-8 w-8 hover:text-danger" aria-label={`Desactivar ${m.nombre}`} onClick={() => setAEliminar(m)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                {puedeEliminar && !m.activo && (
                  <Button variant="icon" className="h-8 w-8 hover:text-success" aria-label={`Reactivar ${m.nombre}`} onClick={() => reactivar(m)}>
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
        title="Desactivar marca"
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
