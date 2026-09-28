import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { Alert } from "@/components/ui/Alert";
import { VentaFormClient } from "../VentaFormClient";

export default async function NuevaVentaPage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto || !tienePermiso(contexto.rol, "ventas", "crear")) {
    return (
      <div>
        <Alert variant="info">No tenés permiso para registrar ventas.</Alert>
      </div>
    );
  }

  const { ferreteriaId } = contexto;
  // Los productos ya no viajan al navegador: se buscan a demanda en
  // /api/productos/buscar. Acá solo se necesita saber si hay alguno.
  const [clientes, cantidadProductos, ferreteria] = await Promise.all([
    prisma.cliente.findMany({ where: { ferreteriaId }, select: { id: true, nombre: true, listaPrecioId: true } }),
    prisma.producto.count({ where: { ferreteriaId, activo: true } }),
    prisma.ferreteria.findUnique({ where: { id: ferreteriaId }, select: { cotizacionDolar: true } }),
  ]);

  return (
    <VentaFormClient
      clientes={clientes}
      hayProductos={cantidadProductos > 0}
      cotizacionDolar={ferreteria?.cotizacionDolar?.toString() ?? null}
    />
  );
}
