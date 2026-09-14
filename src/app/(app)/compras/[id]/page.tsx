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
  const [anulando, setAnulando] = useState(false);
  const [lineaADevolver, setLineaADevolver] = useState<string | null>(null);

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

  async function anular(motivo: string) {
    setError(null);
    setEnviando(true);
    const res = await fetch(`/api/compras/${id}/anular`, {
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
    const res = await fetch(`/api/compra-detalle/${lineaADevolver}/devolucion`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cantidad, motivo }),
    });
    setLineaADevolver(null);
    if (!res.ok) return setError((await res.json()).error);
    cargar();
  }

  if (!compra) return <main><PageLoading /></main>;

  const puedeConfirmar = !!rol && tienePermiso(rol, "compras", "modificar") && compra.estado === "PENDIENTE";
  const puedeAnular = !!rol && tienePermiso(rol, "compras", "anular") && compra.estado !== "ANULADO";
  const puedeDevolver = !!rol && tienePermiso(rol, "compras", "modificar") && compra.estado === "CONFIRMADO";

  return (
    <main className="flex flex-col gap-6">
      <PageHeader
        title={`Compra — ${compra.proveedor.nombre}`}
        description={`Fecha: ${new Date(compra.fecha).toLocaleDateString("es-UY")} · Factura: ${compra.numeroFactura ?? "—"} · Estado: ${compra.estado}`}
      />

      {compra.estado === "ANULADO" && <Alert>Motivo de anulación: {compra.motivoAnulacion}</Alert>}
      {error && <Alert>{error}</Alert>}

      <div className="flex gap-3">
        {puedeConfirmar && <Button onClick={confirmar} loading={enviando}>Confirmar compra</Button>}
        {puedeAnular && <Button variant="danger" onClick={() => setAnulando(true)} disabled={enviando}>Anular compra</Button>}
      </div>

      <Table>
        <Table.Head>
          <Table.Row>
            <Table.HeadCell>Producto</Table.HeadCell>
            <Table.HeadCell>Cantidad</Table.HeadCell>
            <Table.HeadCell>Costo</Table.HeadCell>
            <Table.HeadCell>Subtotal</Table.HeadCell>
            <Table.HeadCell>Devuelto</Table.HeadCell>
            {puedeDevolver && <Table.HeadCell />}
          </Table.Row>
        </Table.Head>
        <tbody>
          {compra.detalle.map((l) => {
            const devuelto = l.devoluciones.reduce((acc, d) => acc + d.cantidad, 0);
            return (
              <Table.Row key={l.id}>
                <Table.Cell>{l.producto.codigo} — {l.producto.descripcion}</Table.Cell>
                <Table.Cell>{l.cantidad}</Table.Cell>
                <Table.Cell>{l.costoUnitario}</Table.Cell>
                <Table.Cell>{l.subtotal}</Table.Cell>
                <Table.Cell>{devuelto}</Table.Cell>
                {puedeDevolver && (
                  <Table.Cell>
                    {devuelto < l.cantidad && (
                      <Button variant="secondary" size="sm" onClick={() => setLineaADevolver(l.id)}>Devolver</Button>
                    )}
                  </Table.Cell>
                )}
              </Table.Row>
            );
          })}
        </tbody>
      </Table>

      <p className="text-sm text-muted-foreground">
        Subtotal: {compra.subtotal} · IVA: {compra.iva} · <span className="font-semibold text-foreground">Total: {compra.total}</span>
      </p>

      <PromptDialog
        open={anulando}
        title="Anular compra"
        label="Motivo de la anulación"
        loading={enviando}
        onConfirm={anular}
        onCancel={() => setAnulando(false)}
      />
      <DevolucionDialog open={lineaADevolver !== null} onConfirm={devolver} onCancel={() => setLineaADevolver(null)} />
    </main>
  );
}
