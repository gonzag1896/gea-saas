import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { TicketVentaClient } from "./TicketVentaClient";

// Vive fuera de (app) a propósito: es una hoja para imprimir, no una
// pantalla de la app — no lleva sidebar ni header. La autorización se
// repite acá a mano (mismo obtenerContextoTenant de siempre) porque esta
// ruta no hereda la guardia de (app)/layout.tsx.
export default async function TicketVentaPage({ params }: { params: { id: string } }) {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");
  if (!tienePermiso(contexto.rol, "ventas", "ver")) redirect("/ventas");

  const [ventaRaw, ferreteria] = await Promise.all([
    prisma.venta.findUnique({
      where: { id_ferreteriaId: { id: params.id, ferreteriaId: contexto.ferreteriaId } },
      include: {
        cliente: { select: { nombre: true, telefono: true } },
        detalle: { include: { producto: { select: { codigo: true, descripcion: true } } } },
      },
    }),
    prisma.ferreteria.findUnique({
      where: { id: contexto.ferreteriaId },
      select: { nombre: true, razonSocial: true, rut: true, telefono: true, direccion: true },
    }),
  ]);
  if (!ventaRaw || !ferreteria) notFound();

  const venta = {
    id: ventaRaw.id,
    fecha: ventaRaw.fecha,
    estado: ventaRaw.estado,
    medioPago: ventaRaw.medioPago,
    subtotal: ventaRaw.subtotal.toString(),
    iva: ventaRaw.iva.toString(),
    total: ventaRaw.total.toString(),
    motivoAnulacion: ventaRaw.motivoAnulacion,
    cliente: ventaRaw.cliente,
    detalle: ventaRaw.detalle.map((l) => ({
      id: l.id,
      cantidad: l.cantidad,
      precio: l.precio.toString(),
      tipoIva: l.tipoIva,
      totalVigente: l.totalVigente.toString(),
      producto: l.producto,
    })),
  };

  return <TicketVentaClient venta={venta} ferreteria={ferreteria} />;
}
