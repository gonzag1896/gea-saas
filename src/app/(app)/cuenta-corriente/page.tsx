import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { PageHeader } from "@/components/ui/PageHeader";
import { Table } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { cn } from "@/lib/cn";

// Sin interactividad (solo lista + links) — Server Component puro, sin
// Client Island: no hace falta ningún estado en el navegador acá.
export default async function CuentaCorrientePage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");

  const { ferreteriaId } = contexto;
  const [clientes, saldosPorCliente] = await Promise.all([
    prisma.cliente.findMany({ where: { ferreteriaId }, select: { id: true, nombre: true, telefono: true }, orderBy: { nombre: "asc" } }),
    prisma.cuentaCliente.groupBy({ by: ["clienteId"], where: { ferreteriaId }, _sum: { debe: true, haber: true } }),
  ]);

  const saldos = new Map(saldosPorCliente.map((s) => [s.clienteId, Number(s._sum.debe ?? 0) - Number(s._sum.haber ?? 0)]));
  const filas = clientes.map((c) => ({ ...c, saldo: saldos.get(c.id) ?? 0 }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Cuenta Corriente" />
      <Table>
        <Table.Head>
          <Table.Row>
            <Table.HeadCell>Cliente</Table.HeadCell>
            <Table.HeadCell>Teléfono</Table.HeadCell>
            <Table.HeadCell>Saldo</Table.HeadCell>
            <Table.HeadCell />
          </Table.Row>
        </Table.Head>
        <tbody>
          {filas.map((c) => (
            <Table.Row key={c.id}>
              <Table.Cell>{c.nombre}</Table.Cell>
              <Table.Cell>{c.telefono ?? "—"}</Table.Cell>
              <Table.Cell className={cn("font-mono tabular-nums", c.saldo > 0 && "text-danger font-medium")}>{c.saldo.toFixed(2)}</Table.Cell>
              <Table.Cell><a href={`/clientes/${c.id}`} className="text-sm text-primary underline underline-offset-2">Ver detalle</a></Table.Cell>
            </Table.Row>
          ))}
        </tbody>
      </Table>
      {filas.length === 0 && <EmptyState message="Todavía no hay clientes cargados." />}
    </div>
  );
}
