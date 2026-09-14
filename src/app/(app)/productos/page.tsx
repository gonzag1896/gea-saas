"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { tienePermiso } from "@/lib/permisos";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Table } from "@/components/ui/Table";
import { ActivoBadge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
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

export default function ProductosPage() {
  const { data: session } = useSession();
  const rol = session?.user.rol;
  const puedeVerPrecios = !!rol; // "precios" módulo: los tres roles tienen "ver"
  const puedeEditarPrecios = !!rol && tienePermiso(rol, "precios", "modificar");

  const [productos, setProductos] = useState<Producto[]>([]);
  const [subCategorias, setSubCategorias] = useState<Opcion[]>([]);
  const [marcas, setMarcas] = useState<Opcion[]>([]);
  const [form, setForm] = useState({ codigo: "", descripcion: "", subCategoriaId: "", marcaId: "", precioCosto: "", precioVenta: "", stockMinimo: "0" });
  const [error, setError] = useState<string | null>(null);
  const [productoEnEdicion, setProductoEnEdicion] = useState<Producto | null>(null);

  async function cargar() {
    const [resProd, resSub, resMarca] = await Promise.all([
      fetch("/api/productos"),
      fetch("/api/subcategorias"),
      fetch("/api/marcas"),
    ]);
    if (resProd.ok) setProductos((await resProd.json()).productos);
    if (resSub.ok) {
      const subs = (await resSub.json()).subCategorias;
      setSubCategorias(subs);
      setForm((f) => ({ ...f, subCategoriaId: f.subCategoriaId || subs[0]?.id || "" }));
    }
    if (resMarca.ok) {
      const marcasData = (await resMarca.json()).marcas;
      setMarcas(marcasData);
      setForm((f) => ({ ...f, marcaId: f.marcaId || marcasData[0]?.id || "" }));
    }
  }
  useEffect(() => { cargar(); }, []);

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
    cargar();
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
    cargar();
  }

  async function toggleActivo(producto: Producto) {
    await fetch(`/api/productos/${producto.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !producto.activo }),
    });
    cargar();
  }

  if (subCategorias.length === 0 || marcas.length === 0) {
    return (
      <main className="flex flex-col gap-6">
        <PageHeader title="Productos" />
        <EmptyState message="Primero cargá al menos una Sub Categoría y una Marca." />
      </main>
    );
  }

  return (
    <main className="flex flex-col gap-6">
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
          {puedeVerPrecios && (
            <>
              <Input type="number" step="0.01" value={form.precioCosto} onChange={(e) => setForm({ ...form, precioCosto: e.target.value })} placeholder="Precio costo" className="max-w-[140px]" />
              <Input type="number" step="0.01" value={form.precioVenta} onChange={(e) => setForm({ ...form, precioVenta: e.target.value })} placeholder="Precio venta" className="max-w-[140px]" />
            </>
          )}
          <Input type="number" value={form.stockMinimo} onChange={(e) => setForm({ ...form, stockMinimo: e.target.value })} placeholder="Stock mínimo" className="max-w-[140px]" />
          <Button type="submit">Agregar</Button>
        </form>
      </Card>

      {error && <Alert>{error}</Alert>}

      <Table>
        <Table.Head>
          <Table.Row>
            <Table.HeadCell>Código</Table.HeadCell>
            <Table.HeadCell>Descripción</Table.HeadCell>
            <Table.HeadCell>Sub Categoría</Table.HeadCell>
            <Table.HeadCell>Marca</Table.HeadCell>
            {puedeVerPrecios && (
              <>
                <Table.HeadCell>Costo</Table.HeadCell>
                <Table.HeadCell>Venta</Table.HeadCell>
              </>
            )}
            <Table.HeadCell>Stock</Table.HeadCell>
            <Table.HeadCell>Estado</Table.HeadCell>
            <Table.HeadCell />
          </Table.Row>
        </Table.Head>
        <tbody>
          {productos.map((p) => (
            <Table.Row key={p.id}>
              <Table.Cell>{p.codigo}</Table.Cell>
              <Table.Cell>{p.descripcion}</Table.Cell>
              <Table.Cell>{p.subCategoria.nombre}</Table.Cell>
              <Table.Cell>{p.marca.nombre}</Table.Cell>
              {puedeVerPrecios && (
                <>
                  <Table.Cell>{p.precioCosto}</Table.Cell>
                  <Table.Cell>
                    <div className="flex items-center gap-2">
                      {p.precioVenta}
                      {puedeEditarPrecios && (
                        <Button variant="ghost" size="sm" onClick={() => setProductoEnEdicion(p)}>
                          Cambiar
                        </Button>
                      )}
                    </div>
                  </Table.Cell>
                </>
              )}
              <Table.Cell>{p.stockActual} (mín. {p.stockMinimo})</Table.Cell>
              <Table.Cell><ActivoBadge activo={p.activo} /></Table.Cell>
              <Table.Cell>
                <div className="flex items-center gap-2">
                  <a href={`/productos/${p.id}`} className="text-sm text-primary underline underline-offset-2">Movimientos</a>
                  <Button variant="secondary" size="sm" onClick={() => toggleActivo(p)}>
                    {p.activo ? "Desactivar" : "Activar"}
                  </Button>
                </div>
              </Table.Cell>
            </Table.Row>
          ))}
        </tbody>
      </Table>

      <PromptDialog
        open={productoEnEdicion !== null}
        title="Cambiar precio de venta"
        label={productoEnEdicion ? `Nuevo precio de venta para ${productoEnEdicion.descripcion}` : ""}
        type="number"
        defaultValue={productoEnEdicion?.precioVenta}
        onConfirm={confirmarCambioPrecio}
        onCancel={() => setProductoEnEdicion(null)}
      />
    </main>
  );
}
