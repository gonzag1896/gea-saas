"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { tienePermiso } from "@/lib/permisos";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Table } from "@/components/ui/Table";
import { PageLoading } from "@/components/ui/PageLoading";
import { PromptDialog } from "@/components/ui/PromptDialog";
import { DevolucionDialog } from "@/components/dialogs/DevolucionDialog";

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
  const [anulando, setAnulando] = useState(false);
  const [lineaADevolver, setLineaADevolver] = useState<string | null>(null);

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

  async function anular(motivo: string) {
    setError(null);
    setEnviando(true);
    const res = await fetch(`/api/ventas/${id}/anular`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo }),
    });
    setEnviando(false);
    setAnulando(false);
    if (!res.ok) return setError((await res.json()).error);
    cargar();
  }

  async function devolver(cantidad: number, motivo: string | undefined) {
    if (!lineaADevolver) return;
    setError(null);
    const res = await fetch(`/api/venta-detalle/${lineaADevolver}/devolucion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cantidad, motivo }),
    });
    setLineaADevolver(null);
    if (!res.ok) return setError((await res.json()).error);
    cargar();
  }

  if (!venta) return <main><PageLoading /></main>;

  const puedeConfirmar = !!rol && tienePermiso(rol, "ventas", "modificar") && venta.estado === "PENDIENTE";
  const puedeAnular = !!rol && tienePermiso(rol, "ventas", "anular") && venta.estado !== "ANULADO";
  const puedeDevolver = !!rol && tienePermiso(rol, "ventas", "modificar") && venta.estado === "CONFIRMADO";

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title={`Venta — ${venta.cliente.nombre}`}
        description={`Fecha: ${new Date(venta.fecha).toLocaleDateString("es-UY")} · Medio de pago: ${venta.medioPago} · Estado: ${venta.estado}`}
      />

      {venta.estado === "ANULADO" && <Alert>Motivo de anulación: {venta.motivoAnulacion}</Alert>}
      {error && <Alert>{error}</Alert>}

      <div className="flex gap-3">
        {puedeConfirmar && <Button onClick={confirmar} loading={enviando}>Confirmar venta</Button>}
        {puedeAnular && <Button variant="danger" onClick={() => setAnulando(true)} disabled={enviando}>Anular venta</Button>}
      </div>

      <Table>
        <Table.Head>
          <Table.Row>
            <Table.HeadCell>Producto</Table.HeadCell>
            <Table.HeadCell>Cantidad</Table.HeadCell>
            <Table.HeadCell>Precio</Table.HeadCell>
            <Table.HeadCell>Total</Table.HeadCell>
            <Table.HeadCell>Total vigente</Table.HeadCell>
            <Table.HeadCell>Devuelto</Table.HeadCell>
            {puedeDevolver && <Table.HeadCell />}
          </Table.Row>
        </Table.Head>
        <tbody>
          {venta.detalle.map((l) => (
            <Table.Row key={l.id}>
              <Table.Cell>{l.producto.codigo} — {l.producto.descripcion}</Table.Cell>
              <Table.Cell>{l.cantidad}</Table.Cell>
              <Table.Cell>{l.precio}</Table.Cell>
              <Table.Cell>{l.total}</Table.Cell>
              <Table.Cell>{l.totalVigente}</Table.Cell>
              <Table.Cell>{l.cantidadDevuelta}</Table.Cell>
              {puedeDevolver && (
                <Table.Cell>
                  {l.cantidadDevuelta < l.cantidad && (
                    <Button variant="secondary" size="sm" onClick={() => setLineaADevolver(l.id)}>Devolver</Button>
                  )}
                </Table.Cell>
              )}
            </Table.Row>
          ))}
        </tbody>
      </Table>

      <p className="text-sm text-muted-foreground">
        Subtotal: {venta.subtotal} · IVA: {venta.iva} · <span className="font-semibold text-foreground">Total: {venta.total}</span>
      </p>

      <PromptDialog
        open={anulando}
        title="Anular venta"
        label="Motivo de la anulación"
        loading={enviando}
        onConfirm={anular}
        onCancel={() => setAnulando(false)}
      />
      <DevolucionDialog open={lineaADevolver !== null} onConfirm={devolver} onCancel={() => setLineaADevolver(null)} />
    </main>
  );
}
