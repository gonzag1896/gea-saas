import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { calcularSaldoCliente } from "@/lib/cuenta-corriente";
import { ClienteCuentaCorrienteClient } from "./ClienteCuentaCorrienteClient";

export default async function ClienteCuentaCorrientePage({ params }: { params: { id: string } }) {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");

  const { ferreteriaId } = contexto;
  const cliente = await prisma.cliente.findUnique({
    where: { id_ferreteriaId: { id: params.id, ferreteriaId } },
    select: { id: true, nombre: true, telefono: true },
  });
  if (!cliente) notFound();

  const [movimientosRaw, saldo] = await Promise.all([
    prisma.cuentaCliente.findMany({ where: { ferreteriaId, clienteId: params.id }, orderBy: { createdAt: "asc" } }),
    calcularSaldoCliente(ferreteriaId, params.id),
  ]);

  const movimientos = movimientosRaw.map((m) => ({
    id: m.id,
    fecha: m.fecha,
    debe: m.debe.toString(),
    haber: m.haber.toString(),
    origenTipo: m.origenTipo,
    referencia: m.referencia,
  }));

  const puedeCobrar = tienePermiso(contexto.rol, "cobros", "crear");

  return <ClienteCuentaCorrienteClient cliente={cliente} movimientosIniciales={movimientos} saldo={saldo} puedeCobrar={puedeCobrar} />;
}
