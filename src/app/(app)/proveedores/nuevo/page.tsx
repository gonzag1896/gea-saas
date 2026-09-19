import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { Alert } from "@/components/ui/Alert";
import { ProveedorFormClient } from "../ProveedorFormClient";

export default async function NuevoProveedorPage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto || !tienePermiso(contexto.rol, "proveedores", "crear")) {
    return (
      <div>
        <Alert variant="info">No tenés permiso para crear proveedores.</Alert>
      </div>
    );
  }

  return <ProveedorFormClient />;
}
