import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { Alert } from "@/components/ui/Alert";
import { CategoriaFormClient } from "../CategoriaFormClient";

export default async function NuevaCategoriaPage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto || !tienePermiso(contexto.rol, "productos", "crear")) {
    return (
      <div>
        <Alert variant="info">No tenés permiso para crear categorías.</Alert>
      </div>
    );
  }

  return <CategoriaFormClient puedeEliminar={tienePermiso(contexto.rol, "productos", "eliminar")} />;
}
