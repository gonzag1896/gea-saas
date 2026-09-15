import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { Alert } from "@/components/ui/Alert";
import { AuditoriaClient } from "./AuditoriaClient";

// Panel de solo lectura — nada acá crea o modifica un AuditLog, eso lo
// hace cada caso de uso de negocio a través de auditar(). Exclusivo de
// Dueño según la matriz (sección 6): Cajero y Depósito no lo ven. La
// vista global entre ferreterías para el Super Admin es parte de
// "Administración de tenants", fuera de esta fase.
export default async function AuditoriaPage() {
  const contexto = await obtenerContextoTenant();

  if (!contexto || !tienePermiso(contexto.rol, "auditoria", "ver")) {
    return (
      <div>
        <Alert variant="info">No tenés permiso para ver esta página.</Alert>
      </div>
    );
  }

  const eventosRaw = await prisma.auditLog.findMany({
    where: { ferreteriaId: contexto.ferreteriaId },
    include: { usuario: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const eventos = eventosRaw.map((e) => ({
    id: e.id,
    fecha: e.createdAt.toLocaleString("es-UY"),
    accion: e.accion,
    usuario: e.usuario?.email ?? "—",
    entidad: e.entidad ?? "—",
  }));

  return <AuditoriaClient eventos={eventos} />;
}
