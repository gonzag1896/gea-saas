import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { Alert } from "@/components/ui/Alert";
import { CompraFormClient } from "../CompraFormClient";

export default async function NuevaCompraPage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto || !tienePermiso(contexto.rol, "compras", "crear")) {
    return (
      <div>
        <Alert variant="info">No tenés permiso para registrar compras.</Alert>
      </div>
    );
  }

  const { ferreteriaId } = contexto;
  // Los productos se buscan a demanda en /api/productos/buscar; acá solo
  // se necesita saber si hay alguno.
  const [proveedores, cantidadProductos, ferreteria] = await Promise.all([
    prisma.proveedor.findMany({ where: { ferreteriaId }, select: { id: true, nombre: true } }),
    prisma.producto.count({ where: { ferreteriaId, activo: true } }),
    prisma.ferreteria.findUnique({ where: { id: ferreteriaId }, select: { cotizacionDolar: true } }),
  ]);

  return (
    <CompraFormClient
      proveedores={proveedores}
      hayProductos={cantidadProductos > 0}
      cotizacionDolar={ferreteria?.cotizacionDolar?.toString() ?? null}
    />
  );
}
