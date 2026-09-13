"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { tienePermiso } from "@/lib/permisos";

type Linea = {
  id: string;
  cantidad: number;
  costoUnitario: string;
  subtotal: string;
  producto: { codigo: string; descripcion: string };
  devoluciones: { id: string; cantidad: number; motivo: string | null }[];
};
type Compra = {
  id: string;
  fecha: string;
  estado: "PENDIENTE" | "CONFIRMADO" | "ANULADO";
  numeroFactura: string | null;
  observaciones: string | null;
  subtotal: string;
  iva: string;
  total: string;
  motivoAnulacion: string | null;
  proveedor: { nombre: string };
  detalle: Linea[];
};

export default function CompraDetallePage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const rol = session?.user.rol;

  const [compra, setCompra] = useState<Compra | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function cargar() {
    const res = await fetch(`/api/compras/${id}`);
    if (res.ok) setCompra((await res.json()).compra);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe recargar cuando cambia el id de la compra
  useEffect(() => { cargar(); }, [id]);

  async function confirmar() {
    setError(null);
    setEnviando(true);
    const res = await fetch(`/api/compras/${id}/confirmar`, { method: "POST" });
    setEnviando(false);
    if (!res.ok) return setError((await res.json()).error);
    cargar();
  }

  async function anular() {
    const motivo = prompt("Motivo de la anulación:");
    if (!motivo) return;
    setError(null);
    setEnviando(true);
    const res = await fetch(`/api/compras/${id}/anular`, {
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
    const res = await fetch(`/api/compra-detalle/${lineaId}/devolucion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cantidad: Number(cantidadStr), motivo }),
    });
    if (!res.ok) return setError((await res.json()).error);
    cargar();
  }

  if (!compra) return <main><p>Cargando…</p></main>;

  const puedeConfirmar = !!rol && tienePermiso(rol, "compras", "modificar") && compra.estado === "PENDIENTE";
  const puedeAnular = !!rol && tienePermiso(rol, "compras", "anular") && compra.estado !== "ANULADO";
  const puedeDevolver = !!rol && tienePermiso(rol, "compras", "modificar") && compra.estado === "CONFIRMADO";

  return (
    <main>
      <h1>Compra — {compra.proveedor.nombre}</h1>
      <p>Fecha: {new Date(compra.fecha).toLocaleDateString("es-UY")} · Factura: {compra.numeroFactura ?? "—"} · Estado: <b>{compra.estado}</b></p>
      {compra.estado === "ANULADO" && <p style={{ color: "crimson" }}>Motivo de anulación: {compra.motivoAnulacion}</p>}

      {error && <p style={{ color: "crimson" }}>{error}</p>}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {puedeConfirmar && <button onClick={confirmar} disabled={enviando}>Confirmar compra</button>}
        {puedeAnular && <button onClick={anular} disabled={enviando}>Anular compra</button>}
      </div>

      <table>
        <thead><tr><th>Producto</th><th>Cantidad</th><th>Costo</th><th>Subtotal</th><th>Devuelto</th>{puedeDevolver && <th></th>}</tr></thead>
        <tbody>
          {compra.detalle.map((l) => {
            const devuelto = l.devoluciones.reduce((acc, d) => acc + d.cantidad, 0);
            return (
              <tr key={l.id}>
                <td>{l.producto.codigo} — {l.producto.descripcion}</td>
                <td>{l.cantidad}</td>
                <td>{l.costoUnitario}</td>
                <td>{l.subtotal}</td>
                <td>{devuelto}</td>
                {puedeDevolver && <td>{devuelto < l.cantidad && <button onClick={() => devolver(l.id)}>Devolver</button>}</td>}
              </tr>
            );
          })}
        </tbody>
      </table>

      <p style={{ marginTop: 16 }}>Subtotal: {compra.subtotal} · IVA: {compra.iva} · <b>Total: {compra.total}</b></p>
    </main>
  );
}
