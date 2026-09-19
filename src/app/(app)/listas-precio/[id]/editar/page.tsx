import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { Alert } from "@/components/ui/Alert";
import { ListaPrecioFormClient } from "../../ListaPrecioFormClient";

export default async function EditarListaPrecioPage({ params }: { params: { id: string } }) {
  const contexto = await obtenerContextoTenant();
  if (!contexto || !tienePermiso(contexto.rol, "listasPrecio", "modificar")) {
    return (
      <div>
        <Alert variant="info">No tenés permiso para editar listas de precio.</Alert>
      </div>
    );
  }

  const lista = await prisma.listaPrecio.findUnique({
    where: { id_ferreteriaId: { id: params.id, ferreteriaId: contexto.ferreteriaId } },
  });
  if (!lista) {
    return (
      <div>
        <Alert variant="info">Lista de precio no encontrada.</Alert>
      </div>
    );
  }

  return <ListaPrecioFormClient lista={lista} puedeEliminar={tienePermiso(contexto.rol, "listasPrecio", "eliminar")} />;
}
