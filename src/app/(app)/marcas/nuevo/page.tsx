import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { Alert } from "@/components/ui/Alert";
import { MarcaFormClient } from "../MarcaFormClient";

export default async function NuevaMarcaPage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto || !tienePermiso(contexto.rol, "productos", "crear")) {
    return (
      <div>
        <Alert variant="info">No tenés permiso para crear marcas.</Alert>
      </div>
    );
  }

  return <MarcaFormClient puedeEliminar={tienePermiso(contexto.rol, "productos", "eliminar")} />;
}
