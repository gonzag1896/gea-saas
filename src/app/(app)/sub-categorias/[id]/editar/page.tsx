import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { Alert } from "@/components/ui/Alert";
import { SubCategoriaFormClient } from "../../SubCategoriaFormClient";

export default async function EditarSubCategoriaPage({ params }: { params: { id: string } }) {
  const contexto = await obtenerContextoTenant();
  if (!contexto || !tienePermiso(contexto.rol, "productos", "modificar")) {
    return (
      <div>
        <Alert variant="info">No tenés permiso para editar familias.</Alert>
      </div>
    );
  }

  const [subCategoria, categorias] = await Promise.all([
    prisma.subCategoria.findUnique({
      where: { id_ferreteriaId: { id: params.id, ferreteriaId: contexto.ferreteriaId } },
    }),
    // Sin filtrar por activo=true: si la familia ya estaba asignada a
    // una categoría desactivada, tiene que seguir apareciendo en el
    // selector — si no, guardar el formulario sin tocarla la reasignaría
    // en silencio a la primera categoría activa de la lista.
    prisma.categoria.findMany({
      where: { ferreteriaId: contexto.ferreteriaId },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  if (!subCategoria) {
    return (
      <div>
        <Alert variant="info">Familia no encontrada.</Alert>
      </div>
    );
  }

  return (
    <SubCategoriaFormClient
      subCategoria={subCategoria}
      categorias={categorias}
      puedeEliminar={tienePermiso(contexto.rol, "productos", "eliminar")}
    />
  );
}
