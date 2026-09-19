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
  const [proveedores, productos, ferreteria] = await Promise.all([
    prisma.proveedor.findMany({ where: { ferreteriaId }, select: { id: true, nombre: true } }),
    prisma.producto.findMany({ where: { ferreteriaId }, select: { id: true, codigo: true, codigoBarras: true, descripcion: true, moneda: true, stockActual: true } }),
    prisma.ferreteria.findUnique({ where: { id: ferreteriaId }, select: { cotizacionDolar: true } }),
  ]);

  return (
    <CompraFormClient
      proveedores={proveedores}
      productos={productos}
      cotizacionDolar={ferreteria?.cotizacionDolar?.toString() ?? null}
    />
  );
}
