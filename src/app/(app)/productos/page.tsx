"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { tienePermiso } from "@/lib/permisos";

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

  async function cambiarPrecio(producto: Producto) {
    const nuevoPrecio = prompt(`Nuevo precio de venta para ${producto.descripcion}`, producto.precioVenta);
    if (nuevoPrecio === null) return;
    const res = await fetch(`/api/productos/${producto.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ precioVenta: Number(nuevoPrecio) }),
    });
    if (!res.ok) setError((await res.json()).error);
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
      <main>
        <h1>Productos</h1>
        <p>Primero cargá al menos una Sub Categoría y una Marca.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Productos</h1>
      <form onSubmit={crear} style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
        <input value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} placeholder="Código" required />
        <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} placeholder="Descripción" required />
        <select value={form.subCategoriaId} onChange={(e) => setForm({ ...form, subCategoriaId: e.target.value })}>
          {subCategorias.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <select value={form.marcaId} onChange={(e) => setForm({ ...form, marcaId: e.target.value })}>
          {marcas.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
        {puedeVerPrecios && (
          <>
            <input type="number" step="0.01" value={form.precioCosto} onChange={(e) => setForm({ ...form, precioCosto: e.target.value })} placeholder="Precio costo" />
            <input type="number" step="0.01" value={form.precioVenta} onChange={(e) => setForm({ ...form, precioVenta: e.target.value })} placeholder="Precio venta" />
          </>
        )}
        <input type="number" value={form.stockMinimo} onChange={(e) => setForm({ ...form, stockMinimo: e.target.value })} placeholder="Stock mínimo" />
        <button type="submit">Agregar</button>
      </form>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <table>
        <thead>
          <tr>
            <th>Código</th><th>Descripción</th><th>Sub Categoría</th><th>Marca</th>
            {puedeVerPrecios && <><th>Costo</th><th>Venta</th></>}
            <th>Stock</th><th>Estado</th><th></th>
          </tr>
        </thead>
        <tbody>
          {productos.map((p) => (
            <tr key={p.id}>
              <td>{p.codigo}</td>
              <td>{p.descripcion}</td>
              <td>{p.subCategoria.nombre}</td>
              <td>{p.marca.nombre}</td>
              {puedeVerPrecios && (
                <>
                  <td>{p.precioCosto}</td>
                  <td>
                    {p.precioVenta}
                    {puedeEditarPrecios && <button onClick={() => cambiarPrecio(p)} style={{ marginLeft: 8 }}>Cambiar</button>}
                  </td>
                </>
              )}
              <td>{p.stockActual} (mín. {p.stockMinimo})</td>
              <td>{p.activo ? "Activo" : "Inactivo"}</td>
              <td>
                <a href={`/productos/${p.id}`}>Movimientos</a>{" "}
                <button onClick={() => toggleActivo(p)}>{p.activo ? "Desactivar" : "Activar"}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
