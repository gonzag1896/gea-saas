"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { tienePermiso } from "@/lib/permisos";

type Opcion = { id: string; nombre?: string; codigo?: string; descripcion?: string };
type Venta = {
  id: string;
  fecha: string;
  estado: "PENDIENTE" | "CONFIRMADO" | "ANULADO";
  medioPago: string;
  total: string;
  cliente: { nombre: string };
};
type Linea = { productoId: string; cantidad: string; precio: string; descuento: string };

export default function VentasPage() {
  const { data: session } = useSession();
  const puedeCrear = !!session?.user.rol && tienePermiso(session.user.rol, "ventas", "crear");

  const [ventas, setVentas] = useState<Venta[]>([]);
  const [clientes, setClientes] = useState<Opcion[]>([]);
  const [productos, setProductos] = useState<Opcion[]>([]);
  const [clienteId, setClienteId] = useState("");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [medioPago, setMedioPago] = useState<"CONTADO" | "CREDITO" | "TRANSFERENCIA">("CONTADO");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [lineaActual, setLineaActual] = useState<Linea>({ productoId: "", cantidad: "1", precio: "", descuento: "0" });
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    const [resVentas, resCli, resProd] = await Promise.all([
      fetch("/api/ventas"),
      fetch("/api/clientes"),
      fetch("/api/productos"),
    ]);
    if (resVentas.ok) setVentas((await resVentas.json()).ventas);
    if (resCli.ok) {
      const clis = (await resCli.json()).clientes;
      setClientes(clis);
      setClienteId((actual) => actual || clis[0]?.id || "");
    }
    if (resProd.ok) {
      const prods = (await resProd.json()).productos;
      setProductos(prods);
      setLineaActual((l) => ({ ...l, productoId: l.productoId || prods[0]?.id || "" }));
    }
  }
  useEffect(() => { cargar(); }, []);

  function agregarLinea() {
    if (!lineaActual.productoId || !lineaActual.cantidad || !lineaActual.precio) return;
    setLineas([...lineas, lineaActual]);
    setLineaActual({ ...lineaActual, cantidad: "1", precio: "", descuento: "0" });
  }

  function quitarLinea(i: number) {
    setLineas(lineas.filter((_, idx) => idx !== i));
  }

  async function crearVenta(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (lineas.length === 0) return setError("Agregá al menos una línea.");

    const res = await fetch("/api/ventas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clienteId,
        fecha: new Date(fecha).toISOString(),
        medioPago,
        detalle: lineas.map((l) => ({ productoId: l.productoId, cantidad: Number(l.cantidad), precio: Number(l.precio), descuento: Number(l.descuento) })),
      }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setLineas([]);
    cargar();
  }

  function nombreProducto(id: string) {
    const p = productos.find((prod) => prod.id === id);
    return p ? `${p.codigo} — ${p.descripcion}` : id;
  }

  return (
    <main>
      <h1>Ventas</h1>

      {puedeCrear && clientes.length > 0 && productos.length > 0 && (
        <form onSubmit={crearVenta} style={{ border: "1px solid #ddd", padding: 16, marginBottom: 24, maxWidth: 640 }}>
          <h3>Nueva venta</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value)}>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            <select value={medioPago} onChange={(e) => setMedioPago(e.target.value as typeof medioPago)}>
              <option value="CONTADO">Contado</option>
              <option value="CREDITO">Crédito</option>
              <option value="TRANSFERENCIA">Transferencia</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap", alignItems: "center" }}>
            <select value={lineaActual.productoId} onChange={(e) => setLineaActual({ ...lineaActual, productoId: e.target.value })}>
              {productos.map((p) => <option key={p.id} value={p.id}>{p.codigo} — {p.descripcion}</option>)}
            </select>
            <input type="number" min="1" value={lineaActual.cantidad} onChange={(e) => setLineaActual({ ...lineaActual, cantidad: e.target.value })} placeholder="Cantidad" style={{ width: 90 }} />
            <input type="number" step="0.01" value={lineaActual.precio} onChange={(e) => setLineaActual({ ...lineaActual, precio: e.target.value })} placeholder="Precio" style={{ width: 100 }} />
            <input type="number" step="0.01" value={lineaActual.descuento} onChange={(e) => setLineaActual({ ...lineaActual, descuento: e.target.value })} placeholder="Descuento" style={{ width: 100 }} />
            <button type="button" onClick={agregarLinea}>+ Línea</button>
          </div>

          {lineas.length > 0 && (
            <table style={{ marginBottom: 8 }}>
              <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Desc.</th><th></th></tr></thead>
              <tbody>
                {lineas.map((l, i) => (
                  <tr key={i}>
                    <td>{nombreProducto(l.productoId)}</td>
                    <td>{l.cantidad}</td>
                    <td>{l.precio}</td>
                    <td>{l.descuento}</td>
                    <td><button type="button" onClick={() => quitarLinea(i)}>Quitar</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {error && <p style={{ color: "crimson" }}>{error}</p>}
          <button type="submit">Registrar venta</button>
        </form>
      )}

      <table>
        <thead><tr><th>Fecha</th><th>Cliente</th><th>Medio de pago</th><th>Total</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {ventas.map((v) => (
            <tr key={v.id}>
              <td>{new Date(v.fecha).toLocaleDateString("es-UY")}</td>
              <td>{v.cliente.nombre}</td>
              <td>{v.medioPago}</td>
              <td>{v.total}</td>
              <td>{v.estado}</td>
              <td><a href={`/ventas/${v.id}`}>Ver</a></td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
