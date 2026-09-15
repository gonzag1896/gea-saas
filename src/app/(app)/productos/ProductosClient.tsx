"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { DataTable } from "@/components/ui/DataTable";
import { ActivoBadge, Badge } from "@/components/ui/Badge";
import { PromptDialog } from "@/components/ui/PromptDialog";

type Opcion = { id: string; nombre: string };
type Producto = {
  id: string;
  codigo: string;
  descripcion: string;
  precioCosto: string;
  precioVenta: string;
  stockActual: number;
  stockMinimo: number;
  activo: boolean;
  subCategoria: { nombre: string };
  marca: { nombre: string };
};

export function ProductosClient({
  productosIniciales,
  subCategorias,
  marcas,
  puedeEditarPrecios,
}: {
  productosIniciales: Producto[];
  subCategorias: Opcion[];
  marcas: Opcion[];
  puedeEditarPrecios: boolean;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    codigo: "", descripcion: "", subCategoriaId: subCategorias[0]?.id ?? "", marcaId: marcas[0]?.id ?? "",
    precioCosto: "", precioVenta: "", stockMinimo: "0",
  });
  const [error, setError] = useState<string | null>(null);
  const [productoEnEdicion, setProductoEnEdicion] = useState<Producto | null>(null);
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

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

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/productos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        codigo: form.codigo,
        descripcion: form.descripcion,
        subCategoriaId: form.subCategoriaId,
        marcaId: form.marcaId,
        precioCosto: form.precioCosto ? Number(form.precioCosto) : undefined,
        precioVenta: form.precioVenta ? Number(form.precioVenta) : undefined,
        stockMinimo: Number(form.stockMinimo),
      }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setForm((f) => ({ ...f, codigo: "", descripcion: "", precioCosto: "", precioVenta: "" }));
    router.refresh();
  }

  async function confirmarCambioPrecio(nuevoPrecio: string) {
    if (!productoEnEdicion) return;
    const res = await fetch(`/api/productos/${productoEnEdicion.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ precioVenta: Number(nuevoPrecio) }),
    });
    if (!res.ok) setError((await res.json()).error);
    setProductoEnEdicion(null);
    router.refresh();
  }

  async function toggleActivo(producto: Producto) {
    setOverrides((o) => ({ ...o, [producto.id]: !producto.activo }));
    await fetch(`/api/productos/${producto.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !producto.activo }),
    });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Productos" />

      <Card>
        <form onSubmit={crear} className="flex flex-wrap gap-3">
          <Input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="Código" required className="max-w-[140px]" />
          <Input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción" required className="max-w-xs" />
          <Select value={form.subCategoriaId} onChange={(e) => setForm({ ...form, subCategoriaId: e.target.value })} className="max-w-[180px]">
            {subCategorias.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
          </Select>
          <Select value={form.marcaId} onChange={(e) => setForm({ ...form, marcaId: e.target.value })} className="max-w-[180px]">
            {marcas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
          </Select>
          <Input type="number" step="0.01" value={form.precioCosto} onChange={(e) => setForm({ ...form, precioCosto: e.target.value })} placeholder="Precio costo" className="max-w-[140px]" />
          <Input type="number" step="0.01" value={form.precioVenta} onChange={(e) => setForm({ ...form, precioVenta: e.target.value })} placeholder="Precio venta" className="max-w-[140px]" />
          <Input type="number" value={form.stockMinimo} onChange={(e) => setForm({ ...form, stockMinimo: e.target.value })} placeholder="Stock mínimo" className="max-w-[140px]" />
          <Button type="submit">Agregar</Button>
        </form>
      </Card>

      {error && <Alert>{error}</Alert>}

      <DataTable
        data={productos}
        rowKey={(p) => p.id}
        searchValue={(p) => `${p.codigo} ${p.descripcion} ${p.subCategoria.nombre} ${p.marca.nombre}`}
        searchPlaceholder="Buscar por código, descripción, sub categoría o marca…"
        emptyMessage="Todavía no hay productos cargados."
        columns={[
          { key: "codigo", header: "Código", sortValue: (p) => p.codigo, render: (p) => p.codigo },
          { key: "descripcion", header: "Descripción", sortValue: (p) => p.descripcion, render: (p) => p.descripcion },
          { key: "subCategoria", header: "Sub Categoría", sortValue: (p) => p.subCategoria.nombre, render: (p) => p.subCategoria.nombre },
          { key: "marca", header: "Marca", sortValue: (p) => p.marca.nombre, render: (p) => p.marca.nombre },
          { key: "costo", header: "Costo", sortValue: (p) => Number(p.precioCosto), className: "font-mono tabular-nums", render: (p) => p.precioCosto },
          {
            key: "venta", header: "Venta", sortValue: (p) => Number(p.precioVenta), className: "font-mono tabular-nums",
            render: (p) => (
              <div className="flex items-center gap-2">
                {p.precioVenta}
                {puedeEditarPrecios && (
                  <Button variant="ghost" size="sm" onClick={() => setProductoEnEdicion(p)}>
                    Cambiar
                  </Button>
                )}
              </div>
            ),
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
            key: "acciones", header: "", render: (p) => (
              <div className="flex items-center gap-2">
                <a href={`/productos/${p.id}`} className="text-sm text-primary underline underline-offset-2">Movimientos</a>
                <Button variant="secondary" size="sm" onClick={() => toggleActivo(p)}>
                  {p.activo ? "Desactivar" : "Activar"}
                </Button>
              </div>
            ),
          },
        ]}
      />

      <PromptDialog
        open={productoEnEdicion !== null}
        title="Cambiar precio de venta"
        label={productoEnEdicion ? `Nuevo precio de venta para ${productoEnEdicion.descripcion}` : ""}
        type="number"
        defaultValue={productoEnEdicion?.precioVenta}
        onConfirm={confirmarCambioPrecio}
        onCancel={() => setProductoEnEdicion(null)}
      />
    </div>
  );
}
