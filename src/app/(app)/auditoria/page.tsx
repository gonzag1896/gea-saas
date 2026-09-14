import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";

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

  const eventos = await prisma.auditLog.findMany({
    where: { ferreteriaId: contexto.ferreteriaId },
    include: { usuario: { select: { email: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Auditoría" />
      <Table>
        <Table.Head>
          <Table.Row>
            <Table.HeadCell>Fecha</Table.HeadCell>
            <Table.HeadCell>Acción</Table.HeadCell>
            <Table.HeadCell>Usuario</Table.HeadCell>
            <Table.HeadCell>Entidad</Table.HeadCell>
          </Table.Row>
        </Table.Head>
        <tbody>
          {eventos.map((evento) => (
            <Table.Row key={evento.id}>
              <Table.Cell>{evento.createdAt.toLocaleString("es-UY")}</Table.Cell>
              <Table.Cell>{evento.accion}</Table.Cell>
              <Table.Cell>{evento.usuario?.email ?? "—"}</Table.Cell>
              <Table.Cell>{evento.entidad ?? "—"}</Table.Cell>
            </Table.Row>
          ))}
        </tbody>
      </Table>
      {eventos.length === 0 && <EmptyState message="Todavía no hay eventos registrados." />}
    </div>
  );
}
