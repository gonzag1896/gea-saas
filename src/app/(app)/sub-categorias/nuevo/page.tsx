import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { SubCategoriaFormClient } from "../SubCategoriaFormClient";

export default async function NuevaSubCategoriaPage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto || !tienePermiso(contexto.rol, "productos", "crear")) {
    return (
      <div>
        <Alert variant="info">No tenés permiso para crear familias.</Alert>
      </div>
    );
  }

  const categorias = await prisma.categoria.findMany({
    where: { ferreteriaId: contexto.ferreteriaId, activo: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });

  if (categorias.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Nueva familia" />
        <EmptyState message="Primero creá al menos una categoría activa." />
      </div>
    );
  }

  return <SubCategoriaFormClient categorias={categorias} puedeEliminar={tienePermiso(contexto.rol, "productos", "eliminar")} />;
}
