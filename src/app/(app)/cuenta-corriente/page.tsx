import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { clientesConSaldoVencido } from "@/lib/cuenta-corriente";
import { CuentaCorrienteClient } from "./CuentaCorrienteClient";

export default async function CuentaCorrientePage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");

  const { ferreteriaId } = contexto;
  const [clientes, saldosPorClienteYMoneda, vencidos] = await Promise.all([
    prisma.cliente.findMany({ where: { ferreteriaId }, select: { id: true, nombre: true, telefono: true }, orderBy: { nombre: "asc" } }),
    prisma.cuentaCliente.groupBy({ by: ["clienteId", "moneda"], where: { ferreteriaId }, _sum: { debe: true, haber: true } }),
    clientesConSaldoVencido(ferreteriaId),
  ]);

  // Pesos y dólares nunca se mezclan: cada cliente tiene un saldo en pesos
  // y uno en dólares, nunca convertidos entre sí.
  const saldosUYU = new Map<string, number>();
  const saldosUSD = new Map<string, number>();
  for (const s of saldosPorClienteYMoneda) {
    const monto = Number(s._sum.debe ?? 0) - Number(s._sum.haber ?? 0);
    (s.moneda === "UYU" ? saldosUYU : saldosUSD).set(s.clienteId, monto);
  }
  const diasVencidoPorCliente = new Map(vencidos.map((v) => [v.id, v.diasVencido]));
  const filas = clientes.map((c) => ({
    ...c,
    saldoUYU: saldosUYU.get(c.id) ?? 0,
    saldoUSD: saldosUSD.get(c.id) ?? 0,
    diasVencido: diasVencidoPorCliente.get(c.id) ?? null,
  }));

  return <CuentaCorrienteClient clientes={filas} />;
}
