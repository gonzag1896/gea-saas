"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, RotateCcw, ArrowLeftRight } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { DataTable } from "@/components/ui/DataTable";
import { ActivoBadge, Badge } from "@/components/ui/Badge";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Tooltip } from "@/components/ui/Tooltip";

type Producto = {
  id: string;
  codigo: string;
  codigoBarras: string | null;
  descripcion: string;
  moneda: "UYU" | "USD";
  precioCosto: string;
  precioVenta: string;
  stockActual: number;
  stockMinimo: number;
  activo: boolean;
  subCategoria: { nombre: string; categoria: { nombre: string } };
  marca: { nombre: string };
};

export function ProductosClient({
  productosIniciales,
  puedeCrear,
  puedeEditar,
  puedeEliminar,
}: {
  productosIniciales: Producto[];
  puedeCrear: boolean;
  puedeEditar: boolean;
  puedeEliminar: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});
  const [aEliminar, setAEliminar] = useState<Producto | null>(null);
  const [eliminando, setEliminando] = useState(false);

  useEffect(() => {
    setOverrides((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const p of productosIniciales) {
        if (next[p.id] !== undefined && next[p.id] === p.activo) {
          delete next[p.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [productosIniciales]);

  const productos = productosIniciales.map((p) => (overrides[p.id] !== undefined ? { ...p, activo: overrides[p.id] } : p));

  async function reactivar(producto: Producto) {
    setOverrides((o) => ({ ...o, [producto.id]: true }));
    const res = await fetch(`/api/productos/${producto.id}`, {
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
    const res = await fetch(`/api/productos/${aEliminar.id}`, {
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
        title="Productos"
        action={puedeCrear && (
          <Button onClick={() => router.push("/productos/nuevo")}>
            <Plus className="h-4 w-4" /> Nuevo producto
          </Button>
        )}
      />

      {error && <Alert>{error}</Alert>}

      <DataTable
        data={productos}
        rowKey={(p) => p.id}
        searchValue={(p) => `${p.codigo} ${p.codigoBarras ?? ""} ${p.descripcion} ${p.subCategoria.nombre} ${p.subCategoria.categoria.nombre} ${p.marca.nombre}`}
        searchPlaceholder="Buscar por código, descripción, familia, categoría o marca…"
        emptyMessage="Todavía no hay productos cargados."
        columns={[
          { key: "codigo", header: "Código", sortValue: (p) => p.codigo, render: (p) => p.codigo },
          { key: "descripcion", header: "Descripción", sortValue: (p) => p.descripcion, render: (p) => p.descripcion },
          {
            key: "subCategoria", header: "Familia", sortValue: (p) => p.subCategoria.nombre,
            render: (p) => (
              <div>
                <div className="text-foreground">{p.subCategoria.nombre}</div>
                <div className="text-xs text-muted-foreground">{p.subCategoria.categoria.nombre}</div>
              </div>
            ),
          },
          { key: "marca", header: "Marca", sortValue: (p) => p.marca.nombre, render: (p) => p.marca.nombre },
          {
            key: "costo", header: "Costo", sortValue: (p) => Number(p.precioCosto), className: "font-mono tabular-nums",
            render: (p) => `${p.moneda === "USD" ? "US$" : "$"} ${p.precioCosto}`,
          },
          {
            key: "venta", header: "Venta", sortValue: (p) => Number(p.precioVenta), className: "font-mono tabular-nums",
            render: (p) => `${p.moneda === "USD" ? "US$" : "$"} ${p.precioVenta}`,
          },
          {
            key: "stock", header: "Stock", sortValue: (p) => p.stockActual,
            render: (p) => (
              <div className="flex items-center gap-2">
                <span>{p.stockActual} (mín. {p.stockMinimo})</span>
                {p.stockActual <= p.stockMinimo && <Badge variant="warning">Stock bajo</Badge>}
              </div>
            ),
          },
          { key: "estado", header: "Estado", sortValue: (p) => Number(p.activo), render: (p) => <ActivoBadge activo={p.activo} /> },
          {
            key: "acciones",
            header: "",
            headClassName: "w-0",
            render: (p) => (
              <div className="flex items-center justify-end gap-1">
                <Tooltip label="Ajustar stock" side="left">
                  <Button variant="icon" className="h-8 w-8" aria-label="Ajustar stock" onClick={() => router.push(`/productos/${p.id}`)}>
                    <ArrowLeftRight className="h-4 w-4" />
                  </Button>
                </Tooltip>
                {puedeEditar && (
                  <Button variant="icon" className="h-8 w-8" aria-label={`Editar ${p.descripcion}`} onClick={() => router.push(`/productos/${p.id}/editar`)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {puedeEliminar && p.activo && (
                  <Button variant="icon" className="h-8 w-8 hover:text-danger" aria-label={`Desactivar ${p.descripcion}`} onClick={() => setAEliminar(p)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                {puedeEliminar && !p.activo && (
                  <Button variant="icon" className="h-8 w-8 hover:text-success" aria-label={`Reactivar ${p.descripcion}`} onClick={() => reactivar(p)}>
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
        title="Desactivar producto"
        message={aEliminar ? `¿Desactivar "${aEliminar.descripcion}"? Vas a poder reactivarlo cuando quieras.` : ""}
        confirmLabel="Desactivar"
        variant="danger"
        loading={eliminando}
        onConfirm={confirmarEliminar}
        onCancel={() => setAEliminar(null)}
      />
    </div>
  );
}
