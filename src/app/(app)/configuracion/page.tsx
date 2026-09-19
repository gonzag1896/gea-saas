import { redirect } from "next/navigation";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { obtenerCotizacionDolar } from "@/lib/configuracion";
import { ConfiguracionClient } from "./ConfiguracionClient";

export default async function ConfiguracionPage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");
  if (!tienePermiso(contexto.rol, "configuracion", "ver")) redirect("/dashboard");

  const cotizacion = await obtenerCotizacionDolar(contexto.ferreteriaId);

  return (
    <ConfiguracionClient
      cotizacionDolar={cotizacion.cotizacionDolar}
      cotizacionDolarFecha={cotizacion.cotizacionDolarFecha?.toISOString() ?? null}
      puedeEditar={tienePermiso(contexto.rol, "configuracion", "modificar")}
    />
  );
}
