import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { Alert } from "@/components/ui/Alert";
import { ClienteFormClient } from "../ClienteFormClient";

export default async function NuevoClientePage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto || !tienePermiso(contexto.rol, "clientes", "crear")) {
    return (
      <div>
        <Alert variant="info">No tenés permiso para crear clientes.</Alert>
      </div>
    );
  }

  const listasPrecio = await prisma.listaPrecio.findMany({
    where: { ferreteriaId: contexto.ferreteriaId, activo: true },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });

  return <ClienteFormClient listasPrecio={listasPrecio} />;
}
