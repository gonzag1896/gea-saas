import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { calcularEsperadoCaja, listarCierres } from "@/lib/caja";
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
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  const [esperado, cierreHoy, cierres] = await Promise.all([
    calcularEsperadoCaja(ferreteriaId, hoy),
    prisma.cierreCaja.findUnique({ where: { ferreteriaId_fecha: { ferreteriaId, fecha: inicioHoy } } }),
    listarCierres(ferreteriaId),
  ]);

  return (
    <CajaClient
      esperado={esperado}
      yaCerradaHoy={!!cierreHoy}
      cierres={cierres.map((c) => ({ ...c, fecha: c.fecha.toISOString() }))}
      puedeCerrar={tienePermiso(contexto.rol, "caja", "crear")}
    />
  );
}
