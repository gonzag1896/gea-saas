import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { Alert } from "@/components/ui/Alert";
import { CategoriaFormClient } from "../../CategoriaFormClient";

export default async function EditarCategoriaPage({ params }: { params: { id: string } }) {
  const contexto = await obtenerContextoTenant();
  if (!contexto || !tienePermiso(contexto.rol, "productos", "modificar")) {
    return (
      <div>
        <Alert variant="info">No tenés permiso para editar categorías.</Alert>
      </div>
    );
  }

  const categoria = await prisma.categoria.findUnique({
    where: { id_ferreteriaId: { id: params.id, ferreteriaId: contexto.ferreteriaId } },
  });
  if (!categoria) {
    return (
      <div>
        <Alert variant="info">Categoría no encontrada.</Alert>
      </div>
    );
  }

  return <CategoriaFormClient categoria={categoria} puedeEliminar={tienePermiso(contexto.rol, "productos", "eliminar")} />;
}
