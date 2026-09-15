import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { CuentaCorrienteClient } from "./CuentaCorrienteClient";

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

  return <CuentaCorrienteClient clientes={filas} />;
}
