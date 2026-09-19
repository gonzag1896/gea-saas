import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { Alert } from "@/components/ui/Alert";
import { ProveedorFormClient } from "../../ProveedorFormClient";

export default async function EditarProveedorPage({ params }: { params: { id: string } }) {
  const contexto = await obtenerContextoTenant();
  if (!contexto || !tienePermiso(contexto.rol, "proveedores", "modificar")) {
    return (
      <div>
        <Alert variant="info">No tenés permiso para editar proveedores.</Alert>
      </div>
    );
  }

  const proveedor = await prisma.proveedor.findUnique({
    where: { id_ferreteriaId: { id: params.id, ferreteriaId: contexto.ferreteriaId } },
    select: { id: true, nombre: true, rut: true, telefono: true, email: true, activo: true },
  });
  if (!proveedor) {
    return (
      <div>
        <Alert variant="info">Proveedor no encontrado.</Alert>
      </div>
    );
  }

  return <ProveedorFormClient proveedor={proveedor} puedeEliminar={tienePermiso(contexto.rol, "proveedores", "eliminar")} />;
}
