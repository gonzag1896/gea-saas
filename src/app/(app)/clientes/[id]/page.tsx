"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { tienePermiso } from "@/lib/permisos";
import { PageHeader } from "@/components/ui/PageHeader";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Table } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageLoading } from "@/components/ui/PageLoading";
import { cn } from "@/lib/cn";

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

  if (!cliente) return <main><PageLoading /></main>;

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title={cliente.nombre}
        description="Saldo actual"
        action={
          <span className={cn("text-xl font-semibold", saldo > 0 ? "text-danger" : "text-foreground")}>
            {saldo.toFixed(2)}
          </span>
        }
      />

      {puedeCobrar && (
        <Card className="max-w-md">
          <h3 className="mb-3 text-sm font-semibold text-foreground">Registrar cobro</h3>
          <form onSubmit={registrarCobro} className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-3">
              <Input type="number" step="0.01" min="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Monto entregado" required />
              <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Referencia (opcional)" />
            </div>
            {error && <Alert>{error}</Alert>}
            <div>
              <Button type="submit">Registrar cobro</Button>
            </div>
          </form>
        </Card>
      )}

      <div>
        <h3 className="mb-3 text-sm font-semibold text-foreground">Movimientos</h3>
        <Table>
          <Table.Head>
            <Table.Row>
              <Table.HeadCell>Fecha</Table.HeadCell>
              <Table.HeadCell>Concepto</Table.HeadCell>
              <Table.HeadCell>Debe</Table.HeadCell>
              <Table.HeadCell>Haber</Table.HeadCell>
              <Table.HeadCell>Referencia</Table.HeadCell>
            </Table.Row>
          </Table.Head>
          <tbody>
            {movimientos.map((m) => (
              <Table.Row key={m.id}>
                <Table.Cell>{new Date(m.fecha).toLocaleDateString("es-UY")}</Table.Cell>
                <Table.Cell>{ETIQUETA_ORIGEN[m.origenTipo] ?? m.origenTipo}</Table.Cell>
                <Table.Cell>{Number(m.debe) > 0 ? m.debe : "—"}</Table.Cell>
                <Table.Cell>{Number(m.haber) > 0 ? m.haber : "—"}</Table.Cell>
                <Table.Cell>{m.referencia ?? "—"}</Table.Cell>
              </Table.Row>
            ))}
          </tbody>
        </Table>
        {movimientos.length === 0 && <EmptyState message="Todavía no hay movimientos para este cliente." />}
      </div>
    </main>
  );
}
