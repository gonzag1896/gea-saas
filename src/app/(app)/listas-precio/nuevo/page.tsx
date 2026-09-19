import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { Alert } from "@/components/ui/Alert";
import { ListaPrecioFormClient } from "../ListaPrecioFormClient";

export default async function NuevaListaPrecioPage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto || !tienePermiso(contexto.rol, "listasPrecio", "crear")) {
    return (
      <div>
        <Alert variant="info">No tenés permiso para crear listas de precio.</Alert>
      </div>
    );
  }

  return <ListaPrecioFormClient puedeEliminar={tienePermiso(contexto.rol, "listasPrecio", "eliminar")} />;
}
