import { redirect } from "next/navigation";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { calcularEsperadoCaja, listarCierres, fechaCubiertaPorCierre } from "@/lib/caja";
import { Alert } from "@/components/ui/Alert";
import { CajaClient } from "./CajaClient";

export default async function CajaPage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");

  if (!tienePermiso(contexto.rol, "caja", "ver")) {
    return (
      <div>
        <Alert variant="info">No tenés permiso para ver la caja.</Alert>
      </div>
    );
  }

  const { ferreteriaId } = contexto;
  const hoy = new Date();

  const [esperado, hoyCubierta, cierres] = await Promise.all([
    calcularEsperadoCaja(ferreteriaId, hoy),
    fechaCubiertaPorCierre(ferreteriaId, hoy),
    listarCierres(ferreteriaId),
  ]);

  return (
    <CajaClient
      esperado={esperado}
      yaCerradaHoy={hoyCubierta}
      hoy={hoy.toISOString().slice(0, 10)}
      cierres={cierres.map((c) => ({ ...c, fecha: c.fecha.toISOString(), fechaHasta: c.fechaHasta.toISOString() }))}
      puedeCerrar={tienePermiso(contexto.rol, "caja", "crear")}
      puedeEditar={tienePermiso(contexto.rol, "caja", "modificar")}
    />
  );
}
