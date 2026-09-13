"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { tienePermiso } from "@/lib/permisos";

type Opcion = { id: string; nombre?: string; codigo?: string; descripcion?: string };
type Compra = {
  id: string;
  fecha: string;
  estado: "PENDIENTE" | "CONFIRMADO" | "ANULADO";
  total: string;
  proveedor: { nombre: string };
  detalle: unknown[];
};
type Linea = { productoId: string; cantidad: string; costoUnitario: string; tipoIva: "EXENTO" | "TOTAL" };

export default function ComprasPage() {
  const { data: session } = useSession();
  const puedeCrear = !!session?.user.rol && tienePermiso(session.user.rol, "compras", "crear");

  const [compras, setCompras] = useState<Compra[]>([]);
  const [proveedores, setProveedores] = useState<Opcion[]>([]);
  const [productos, setProductos] = useState<Opcion[]>([]);
  const [proveedorId, setProveedorId] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [numeroFactura, setNumeroFactura] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [lineaActual, setLineaActual] = useState<Linea>({ productoId: "", cantidad: "1", costoUnitario: "", tipoIva: "EXENTO" });
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    const [resCompras, resProv, resProd] = await Promise.all([
      fetch("/api/compras"),
      fetch("/api/proveedores"),
      fetch("/api/productos"),
    ]);
    if (resCompras.ok) setCompras((await resCompras.json()).compras);
    if (resProv.ok) {
      const provs = (await resProv.json()).proveedores;
      setProveedores(provs);
      setProveedorId((actual) => actual || provs[0]?.id || "");
    }
    if (resProd.ok) {
      const prods = (await resProd.json()).productos;
      setProductos(prods);
      setLineaActual((l) => ({ ...l, productoId: l.productoId || prods[0]?.id || "" }));
    }
  }
  useEffect(() => { cargar(); }, []);

  function agregarLinea() {
    if (!lineaActual.productoId || !lineaActual.cantidad || !lineaActual.costoUnitario) return;
    setLineas([...lineas, lineaActual]);
    setLineaActual({ ...lineaActual, cantidad: "1", costoUnitario: "" });
  }

  function quitarLinea(i: number) {
    setLineas(lineas.filter((_, idx) => idx !== i));
  }

  async function crearCompra(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (lineas.length === 0) return setError("Agregá al menos una línea.");

    const res = await fetch("/api/compras", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        proveedorId,
        fecha: new Date(fecha).toISOString(),
        numeroFactura: numeroFactura || undefined,
        detalle: lineas.map((l) => ({ productoId: l.productoId, cantidad: Number(l.cantidad), costoUnitario: Number(l.costoUnitario), tipoIva: l.tipoIva })),
      }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setLineas([]);
    setNumeroFactura("");
    cargar();
  }

  function nombreProducto(id: string) {
    const p = productos.find((prod) => prod.id === id);
    return p ? `${p.codigo} — ${p.descripcion}` : id;
  }

  return (
    <main>
      <h1>Compras</h1>

      {puedeCrear && proveedores.length > 0 && productos.length > 0 && (
        <form onSubmit={crearCompra} style={{ border: "1px solid #ddd", padding: 16, marginBottom: 24, maxWidth: 640 }}>
          <h3>Nueva compra</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value)}>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            <input value={numeroFactura} onChange={(e) => setNumeroFactura(e.target.value)} placeholder="N° Factura" />
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select value={lineaActual.productoId} onChange={(e) => setLineaActual({ ...lineaActual, productoId: e.target.value })}>
              {productos.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.descripcion}</option>)}
            </select>
            <input type="number" min="1" value={lineaActual.cantidad} onChange={(e) => setLineaActual({ ...lineaActual, cantidad: e.target.value })} placeholder="Cantidad" style={{ width: 90 }} />
            <input type="number" step="0.01" value={lineaActual.costoUnitario} onChange={(e) => setLineaActual({ ...lineaActual, costoUnitario: e.target.value })} placeholder="Costo unitario" style={{ width: 120 }} />
            <select value={lineaActual.tipoIva} onChange={(e) => setLineaActual({ ...lineaActual, tipoIva: e.target.value as "EXENTO" | "TOTAL" })}>
              <option value="EXENTO">Exento</option>
              <option value="TOTAL">IVA 22%</option>
            </select>
            <button type="button" onClick={agregarLinea}>+ Línea</button>
          </div>

          {lineas.length > 0 && (
            <table style={{ marginBottom: 8 }}>
              <thead><tr><th>Producto</th><th>Cant.</th><th>Costo</th><th>IVA</th><th></th></tr></thead>
              <tbody>
                {lineas.map((l, i) => (
                  <tr key={i}>
                    <td>{nombreProducto(l.productoId)}</td>
                    <td>{l.cantidad}</td>
                    <td>{l.costoUnitario}</td>
                    <td>{l.tipoIva === "TOTAL" ? "22%" : "Exento"}</td>
                    <td><button type="button" onClick={() => quitarLinea(i)}>Quitar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {error && <p style={{ color: "crimson" }}>{error}</p>}
          <button type="submit">Registrar compra</button>
        </form>
      )}

      <table>
        <thead><tr><th>Fecha</th><th>Proveedor</th><th>Total</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {compras.map((c) => (
            <tr key={c.id}>
              <td>{new Date(c.fecha).toLocaleDateString("es-UY")}</td>
              <td>{c.proveedor.nombre}</td>
              <td>{c.total}</td>
              <td>{c.estado}</td>
              <td><a href={`/compras/${c.id}`}>Ver</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
