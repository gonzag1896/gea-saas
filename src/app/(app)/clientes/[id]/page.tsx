"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { tienePermiso } from "@/lib/permisos";

type Movimiento = {
  id: string;
  fecha: string;
  debe: string;
  haber: string;
  origenTipo: string;
  referencia: string | null;
};
type Cliente = { id: string; nombre: string; telefono: string | null };

const ETIQUETA_ORIGEN: Record<string, string> = {
  VENTA_CREDITO: "Venta a crédito",
  COBRO: "Cobro",
  DEVOLUCION_VENTA: "Devolución",
  ANULACION_VENTA_CREDITO: "Anulación de venta",
};

export default function ClienteCuentaCorrientePage() {
  const { id } = useParams<{ id: string }>();
  const { data: session } = useSession();
  const puedeCobrar = !!session?.user.rol && tienePermiso(session.user.rol, "cobros", "crear");

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [movimientos, setMovimientos] = useState<Movimiento[]>([]);
  const [saldo, setSaldo] = useState(0);
  const [monto, setMonto] = useState("");
  const [referencia, setReferencia] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function cargar() {
    const res = await fetch(`/api/clientes/${id}/cuenta-corriente`);
    if (res.ok) {
      const data = await res.json();
      setCliente(data.cliente);
      setMovimientos(data.movimientos);
      setSaldo(data.saldo);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe recargar cuando cambia el id del cliente
  useEffect(() => { cargar(); }, [id]);

  async function registrarCobro(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch(`/api/clientes/${id}/cobro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ monto: Number(monto), referencia: referencia || undefined }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error);
    setMonto("");
    setReferencia("");
    cargar();
  }

  if (!cliente) return <main><p>Cargando…</p></main>;

  return (
    <main>
      <h1>{cliente.nombre}</h1>
      <p>Saldo actual: <b style={{ color: saldo > 0 ? "crimson" : undefined }}>{saldo.toFixed(2)}</b></p>

      {puedeCobrar && (
        <form onSubmit={registrarCobro} style={{ border: "1px solid #ddd", padding: 16, marginBottom: 24, maxWidth: 420 }}>
          <h3>Registrar cobro</h3>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <input type="number" step="0.01" min="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Monto entregado" required />
            <input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Referencia (opcional)" />
          </div>
          {error && <p style={{ color: "crimson" }}>{error}</p>}
          <button type="submit">Registrar cobro</button>
        </form>
      )}

      <h3>Movimientos</h3>
      <table>
        <thead><tr><th>Fecha</th><th>Concepto</th><th>Debe</th><th>Haber</th><th>Referencia</th></tr></thead>
        <tbody>
          {movimientos.map((m) => (
            <tr key={m.id}>
              <td>{new Date(m.fecha).toLocaleDateString("es-UY")}</td>
              <td>{ETIQUETA_ORIGEN[m.origenTipo] ?? m.origenTipo}</td>
              <td>{Number(m.debe) > 0 ? m.debe : "—"}</td>
              <td>{Number(m.haber) > 0 ? m.haber : "—"}</td>
              <td>{m.referencia ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {movimientos.length === 0 && <p>Todavía no hay movimientos para este cliente.</p>}
    </main>
  );
}
