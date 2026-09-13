"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { tienePermiso } from "@/lib/permisos";

type Linea = {
  id: string;
  cantidad: number;
  cantidadDevuelta: number;
  precio: string;
  total: string;
  totalVigente: string;
  producto: { codigo: string; descripcion: string };
};
type Venta = {
  id: string;
  fecha: string;
  estado: "PENDIENTE" | "CONFIRMADO" | "ANULADO";
  medioPago: string;
  subtotal: string;
  iva: string;
  total: string;
  motivoAnulacion: string | null;
  cliente: { nombre: string };
  detalle: Linea[];
};

export default function VentaDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const rol = session?.user.rol;

  const [venta, setVenta] = useState<Venta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function cargar() {
    const res = await fetch(`/api/ventas/${id}`);
    if (res.ok) setVenta((await res.json()).venta);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe recargar cuando cambia el id de la venta
  useEffect(() => { cargar(); }, [id]);

  async function confirmar() {
    setError(null);
    setEnviando(true);
    const res = await fetch(`/api/ventas/${id}/confirmar`, { method: "POST" });
    setEnviando(false);
    if (!res.ok) return setError((await res.json()).error);
    cargar();
  }

  async function anular() {
    const motivo = prompt("Motivo de la anulación:");
    if (!motivo) return;
    setError(null);
    setEnviando(true);
    const res = await fetch(`/api/ventas/${id}/anular`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo }),
    });
    setEnviando(false);
    if (!res.ok) return setError((await res.json()).error);
    cargar();
  }

  async function devolver(lineaId: string) {
    const cantidadStr = prompt("Cantidad a devolver:");
    if (!cantidadStr) return;
    const motivo = prompt("Motivo (opcional):") ?? undefined;
    setError(null);
    const res = await fetch(`/api/venta-detalle/${lineaId}/devolucion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cantidad: Number(cantidadStr), motivo }),
    });
    if (!res.ok) return setError((await res.json()).error);
    cargar();
  }

  if (!venta) return <main><p>Cargando…</p></main>;

  const puedeConfirmar = !!rol && tienePermiso(rol, "ventas", "modificar") && venta.estado === "PENDIENTE";
  const puedeAnular = !!rol && tienePermiso(rol, "ventas", "anular") && venta.estado !== "ANULADO";
  const puedeDevolver = !!rol && tienePermiso(rol, "ventas", "modificar") && venta.estado === "CONFIRMADO";

  return (
    <main>
      <h1>Venta — {venta.cliente.nombre}</h1>
      <p>Fecha: {new Date(venta.fecha).toLocaleDateString("es-UY")} · Medio de pago: {venta.medioPago} · Estado: <b>{venta.estado}</b></p>
      {venta.estado === "ANULADO" && <p style={{ color: "crimson" }}>Motivo de anulación: {venta.motivoAnulacion}</p>}

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {puedeConfirmar && <button onClick={confirmar} disabled={enviando}>Confirmar venta</button>}
        {puedeAnular && <button onClick={anular} disabled={enviando}>Anular venta</button>}
      </div>

      <table>
        <thead><tr><th>Producto</th><th>Cantidad</th><th>Precio</th><th>Total</th><th>Total vigente</th><th>Devuelto</th>{puedeDevolver && <th></th>}</tr></thead>
        <tbody>
          {venta.detalle.map((l) => (
            <tr key={l.id}>
              <td>{l.producto.codigo} — {l.producto.descripcion}</td>
              <td>{l.cantidad}</td>
              <td>{l.precio}</td>
              <td>{l.total}</td>
              <td>{l.totalVigente}</td>
              <td>{l.cantidadDevuelta}</td>
              {puedeDevolver && <td>{l.cantidadDevuelta < l.cantidad && <button onClick={() => devolver(l.id)}>Devolver</button>}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: 16 }}>Subtotal: {venta.subtotal} · IVA: {venta.iva} · <b>Total: {venta.total}</b></p>
    </main>
  );
}
