import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";

// Panel de solo lectura — nada acá crea o modifica un AuditLog, eso lo
// hace cada caso de uso de negocio a través de auditar(). Exclusivo de
// Dueño según la matriz (sección 6): Cajero y Depósito no lo ven. La
// vista global entre ferreterías para el Super Admin es parte de
// "Administración de tenants", fuera de esta fase.
export default async function AuditoriaPage() {
  const contexto = await obtenerContextoTenant();

  if (!contexto || !tienePermiso(contexto.rol, "auditoria", "ver")) {
    return (
      <main>
        <p>No tenés permiso para ver esta página.</p>
      </main>
    );
  }

  const eventos = await prisma.auditLog.findMany({
    where: { ferreteriaId: contexto.ferreteriaId },
    include: { usuario: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <main>
      <h1>Auditoría</h1>
      <table>
        <thead>
          <tr>
            <th>Fecha</th>
            <th>Acción</th>
            <th>Usuario</th>
            <th>Entidad</th>
          </tr>
        </thead>
        <tbody>
          {eventos.map((evento) => (
            <tr key={evento.id}>
              <td>{evento.createdAt.toLocaleString("es-UY")}</td>
              <td>{evento.accion}</td>
              <td>{evento.usuario?.email ?? "—"}</td>
              <td>{evento.entidad ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {eventos.length === 0 && <p>Todavía no hay eventos registrados.</p>}
    </main>
  );
}
