"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, RotateCcw, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { DataTable } from "@/components/ui/DataTable";
import { ActivoBadge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type Proveedor = { id: string; nombre: string; rut: string | null; telefono: string | null; email: string | null; activo: boolean };

export function ProveedoresClient({
  proveedoresIniciales,
  puedeCrear,
  puedeEditar,
  puedeEliminar,
}: {
  proveedoresIniciales: Proveedor[];
  puedeCrear: boolean;
  puedeEditar: boolean;
  puedeEliminar: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [aEliminar, setAEliminar] = useState<Proveedor | null>(null);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    setOverrides((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const p of proveedoresIniciales) {
        if (next[p.id] !== undefined && next[p.id] === p.activo) {
          delete next[p.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [proveedoresIniciales]);

  const proveedores = proveedoresIniciales.map((p) => (overrides[p.id] !== undefined ? { ...p, activo: overrides[p.id] } : p));

  async function reactivar(proveedor: Proveedor) {
    setOverrides((o) => ({ ...o, [proveedor.id]: true }));
    const res = await fetch(`/api/proveedores/${proveedor.id}`, {
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
    const res = await fetch(`/api/proveedores/${aEliminar.id}`, {
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
        title="Proveedores"
        action={puedeCrear && (
          <Button onClick={() => router.push("/proveedores/nuevo")}>
            <Plus className="h-4 w-4" /> Nuevo proveedor
          </Button>
        )}
      />

      {error && <Alert>{error}</Alert>}

      <DataTable
        data={proveedores}
        rowKey={(p) => p.id}
        searchValue={(p) => `${p.nombre} ${p.rut ?? ""} ${p.email ?? ""}`}
        searchPlaceholder="Buscar proveedor…"
        emptyMessage="Todavía no hay proveedores cargados."
        columns={[
          { key: "nombre", header: "Nombre", sortValue: (p) => p.nombre, render: (p) => p.nombre },
          { key: "rut", header: "RUT", sortValue: (p) => p.rut ?? "", render: (p) => p.rut ?? "—" },
          { key: "telefono", header: "Teléfono", render: (p) => p.telefono ?? "—" },
          { key: "email", header: "Email", render: (p) => p.email ?? "—" },
          { key: "estado", header: "Estado", sortValue: (p) => Number(p.activo), render: (p) => <ActivoBadge activo={p.activo} /> },
          {
            key: "acciones",
            header: "",
            headClassName: "w-0",
            render: (p) => (
              <div className="flex items-center justify-end gap-1">
                <Button variant="icon" className="h-8 w-8" aria-label={`Cuenta corriente de ${p.nombre}`} onClick={() => router.push(`/proveedores/${p.id}`)}>
                  <Wallet className="h-4 w-4" />
                </Button>
                {puedeEditar && (
                  <Button variant="icon" className="h-8 w-8" aria-label={`Editar ${p.nombre}`} onClick={() => router.push(`/proveedores/${p.id}/editar`)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {puedeEliminar && p.activo && (
                  <Button variant="icon" className="h-8 w-8 hover:text-danger" aria-label={`Desactivar ${p.nombre}`} onClick={() => setAEliminar(p)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                {puedeEliminar && !p.activo && (
                  <Button variant="icon" className="h-8 w-8 hover:text-success" aria-label={`Reactivar ${p.nombre}`} onClick={() => reactivar(p)}>
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
        title="Desactivar proveedor"
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
