import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { Alert } from "@/components/ui/Alert";
import { ClienteFormClient } from "../../ClienteFormClient";

export default async function EditarClientePage({ params }: { params: { id: string } }) {
  const contexto = await obtenerContextoTenant();
  if (!contexto || !tienePermiso(contexto.rol, "clientes", "modificar")) {
    return (
      <div>
        <Alert variant="info">No tenés permiso para editar clientes.</Alert>
      </div>
    );
  }

  const { ferreteriaId } = contexto;
  const [cliente, listasPrecio] = await Promise.all([
    prisma.cliente.findUnique({
      where: { id_ferreteriaId: { id: params.id, ferreteriaId } },
      select: { id: true, nombre: true, telefono: true, activo: true, listaPrecioId: true },
    }),
    // Sin filtrar por activo=true: si el cliente ya estaba asignado a una
    // lista desactivada, tiene que seguir apareciendo en el selector —
    // mismo criterio que categoría/sub categoría en sus formularios.
    prisma.listaPrecio.findMany({ where: { ferreteriaId }, select: { id: true, nombre: true }, orderBy: { nombre: "asc" } }),
  ]);
  if (!cliente) {
    return (
      <div>
        <Alert variant="info">Cliente no encontrado.</Alert>
      </div>
    );
  }

  return (
    <ClienteFormClient
      cliente={cliente}
      listasPrecio={listasPrecio}
      puedeEliminar={tienePermiso(contexto.rol, "clientes", "eliminar")}
    />
  );
}
