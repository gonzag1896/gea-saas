import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";

// Un solo groupBy en vez de N llamadas a calcularSaldoCliente — acá se
// necesita el saldo de todos los clientes a la vez, no de uno.
export async function GET() {
  const resultado = await requirePermiso("cuentaCorriente", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const { ferreteriaId } = resultado.contexto;
  const [clientes, saldosPorCliente] = await Promise.all([
    prisma.cliente.findMany({ where: { ferreteriaId }, orderBy: { nombre: "asc" } }),
    prisma.cuentaCliente.groupBy({ by: ["clienteId"], where: { ferreteriaId }, _sum: { debe: true, haber: true } }),
  ]);

  const saldos = new Map(saldosPorCliente.map((s) => [s.clienteId, Number(s._sum.debe ?? 0) - Number(s._sum.haber ?? 0)]));

  const filas = clientes.map((c) => ({ ...c, saldo: saldos.get(c.id) ?? 0 }));
  return NextResponse.json({ clientes: filas });
}
