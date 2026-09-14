import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { CompraDetalleClient } from "./CompraDetalleClient";

export default async function CompraDetallePage({ params }: { params: { id: string } }) {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");

  const compraRaw = await prisma.compra.findUnique({
    where: { id_ferreteriaId: { id: params.id, ferreteriaId: contexto.ferreteriaId } },
    include: {
      proveedor: { select: { nombre: true } },
      detalle: { include: { producto: { select: { codigo: true, descripcion: true } }, devoluciones: true } },
    },
  });
  if (!compraRaw) notFound();

  const compra = {
    id: compraRaw.id,
    fecha: compraRaw.fecha,
    estado: compraRaw.estado,
    numeroFactura: compraRaw.numeroFactura,
    subtotal: compraRaw.subtotal.toString(),
    iva: compraRaw.iva.toString(),
    total: compraRaw.total.toString(),
    motivoAnulacion: compraRaw.motivoAnulacion,
    proveedor: compraRaw.proveedor,
    detalle: compraRaw.detalle.map((l) => ({
      id: l.id,
      cantidad: l.cantidad,
      costoUnitario: l.costoUnitario.toString(),
      subtotal: l.subtotal.toString(),
      producto: l.producto,
      devoluciones: l.devoluciones.map((d) => ({ id: d.id, cantidad: d.cantidad, motivo: d.motivo })),
    })),
  };

  const puedeConfirmar = tienePermiso(contexto.rol, "compras", "modificar");
  const puedeAnular = tienePermiso(contexto.rol, "compras", "anular");
  const puedeDevolver = tienePermiso(contexto.rol, "compras", "modificar");

  return <CompraDetalleClient compra={compra} puedeConfirmar={puedeConfirmar} puedeAnular={puedeAnular} puedeDevolver={puedeDevolver} />;
}
