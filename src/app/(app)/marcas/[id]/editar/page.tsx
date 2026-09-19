import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { Alert } from "@/components/ui/Alert";
import { MarcaFormClient } from "../../MarcaFormClient";

export default async function EditarMarcaPage({ params }: { params: { id: string } }) {
  const contexto = await obtenerContextoTenant();
  if (!contexto || !tienePermiso(contexto.rol, "productos", "modificar")) {
    return (
      <div>
        <Alert variant="info">No tenés permiso para editar marcas.</Alert>
      </div>
    );
  }

  const marca = await prisma.marca.findUnique({
    where: { id_ferreteriaId: { id: params.id, ferreteriaId: contexto.ferreteriaId } },
  });
  if (!marca) {
    return (
      <div>
        <Alert variant="info">Marca no encontrada.</Alert>
      </div>
    );
  }

  return <MarcaFormClient marca={marca} puedeEliminar={tienePermiso(contexto.rol, "productos", "eliminar")} />;
}
