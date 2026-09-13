"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { tienePermiso } from "@/lib/permisos";

type Producto = { id: string; codigo: string; descripcion: string; stockActual: number; stockMinimo: number };
type Movimiento = {
  id: string;
  fecha: string;
  tipo: "ENTRADA" | "SALIDA" | "AJUSTE_POSITIVO" | "AJUSTE_NEGATIVO";
  cantidad: number;
  motivo: string | null;
  origenTipo: string;
};

const ETIQUETA_TIPO: Record<Movimiento["tipo"], string> = {
  ENTRADA: "Entrada",
  SALIDA: "Salida",
  AJUSTE_POSITIVO: "Ajuste (+)",
  AJUSTE_NEGATIVO: "Ajuste (−)",
};

export default function ProductoMovimientosPage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const puedeAjustar = !!session?.user.rol && tienePermiso(session.user.rol, "ajustesStock", "crear");

  const [producto, setProducto] = useState<Producto | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [tipo, setTipo] = useState<"AJUSTE_POSITIVO" | "AJUSTE_NEGATIVO">("AJUSTE_POSITIVO");
  const [cantidad, setCantidad] = useState("1");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    const res = await fetch(`/api/productos/${id}/movimientos`);
    if (res.ok) {
      const data = await res.json();
      setProducto(data.producto);
      setMovimientos(data.movimientos);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe recargar cuando cambia el id del producto
  useEffect(() => { cargar(); }, [id]);

  async function registrarAjuste(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/productos/${id}/ajuste-stock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tipo, cantidad: Number(cantidad), motivo }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setMotivo("");
    cargar();
  }

  if (!producto) return <main><p>Cargando…</p></main>;

  return (
    <main>
      <h1>{producto.codigo} — {producto.descripcion}</h1>
      <p>Stock actual: <b>{producto.stockActual}</b> (mínimo: {producto.stockMinimo})</p>

      {puedeAjustar && (
        <form onSubmit={registrarAjuste} style={{ border: "1px solid #ddd", padding: 16, marginBottom: 24, maxWidth: 480 }}>
          <h3>Ajustar stock</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
            <select value={tipo} onChange={(e) => setTipo(e.target.value as typeof tipo)}>
              <option value="AJUSTE_POSITIVO">Ajuste positivo</option>
              <option value="AJUSTE_NEGATIVO">Ajuste negativo</option>
            </select>
            <input type="number" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder="Cantidad" style={{ width: 100 }} />
          </div>
          <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (ej: diferencia de inventario)" style={{ width: "100%", marginBottom: 8 }} required />
          {error && <p style={{ color: "crimson" }}>{error}</p>}
          <button type="submit">Registrar ajuste</button>
        </form>
      )}

      <h3>Historial de movimientos</h3>
      <table>
        <thead><tr><th>Fecha</th><th>Tipo</th><th>Cantidad</th><th>Origen</th><th>Motivo</th></tr></thead>
        <tbody>
          {movimientos.map((m) => (
            <tr key={m.id}>
              <td>{new Date(m.fecha).toLocaleDateString("es-UY")}</td>
              <td>{ETIQUETA_TIPO[m.tipo]}</td>
              <td>{m.cantidad}</td>
              <td>{m.origenTipo}</td>
              <td>{m.motivo ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {movimientos.length === 0 && <p>Todavía no hay movimientos para este producto.</p>}
    </main>
  );
}
