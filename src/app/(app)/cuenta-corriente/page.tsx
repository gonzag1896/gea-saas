import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { clientesConSaldoVencido } from "@/lib/cuenta-corriente";
import { CuentaCorrienteClient } from "./CuentaCorrienteClient";

export default async function CuentaCorrientePage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");

  const { ferreteriaId } = contexto;
  const [clientes, saldosPorCliente, vencidos] = await Promise.all([
    prisma.cliente.findMany({ where: { ferreteriaId }, select: { id: true, nombre: true, telefono: true }, orderBy: { nombre: "asc" } }),
    prisma.cuentaCliente.groupBy({ by: ["clienteId"], where: { ferreteriaId }, _sum: { debe: true, haber: true } }),
    clientesConSaldoVencido(ferreteriaId),
  ]);

  const saldos = new Map(saldosPorCliente.map((s) => [s.clienteId, Number(s._sum.debe ?? 0) - Number(s._sum.haber ?? 0)]));
  const diasVencidoPorCliente = new Map(vencidos.map((v) => [v.id, v.diasVencido]));
  const filas = clientes.map((c) => ({ ...c, saldo: saldos.get(c.id) ?? 0, diasVencido: diasVencidoPorCliente.get(c.id) ?? null }));

  return <CuentaCorrienteClient clientes={filas} />;
}
