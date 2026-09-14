import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { VentaDetalleClient } from "./VentaDetalleClient";

export default async function VentaDetallePage({ params }: { params: { id: string } }) {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");

  const ventaRaw = await prisma.venta.findUnique({
    where: { id_ferreteriaId: { id: params.id, ferreteriaId: contexto.ferreteriaId } },
    include: {
      cliente: { select: { nombre: true } },
      detalle: { include: { producto: { select: { codigo: true, descripcion: true } }, devoluciones: true } },
    },
  });
  if (!ventaRaw) notFound();

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
      cantidadDevuelta: l.cantidadDevuelta,
      precio: l.precio.toString(),
      total: l.total.toString(),
      totalVigente: l.totalVigente.toString(),
      producto: l.producto,
    })),
  };

  const puedeConfirmar = tienePermiso(contexto.rol, "ventas", "modificar");
  const puedeAnular = tienePermiso(contexto.rol, "ventas", "anular");
  const puedeDevolver = tienePermiso(contexto.rol, "ventas", "modificar");

  return <VentaDetalleClient venta={venta} puedeConfirmar={puedeConfirmar} puedeAnular={puedeAnular} puedeDevolver={puedeDevolver} />;
}
