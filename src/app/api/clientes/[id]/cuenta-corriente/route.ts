import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";
import { calcularSaldoCliente } from "@/lib/cuenta-corriente";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const resultado = await requirePermiso("cuentaCorriente", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const { ferreteriaId } = resultado.contexto;
  const cliente = await prisma.cliente.findUnique({ where: { id_ferreteriaId: { id: params.id, ferreteriaId } } });
  if (!cliente) return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });

  const [movimientos, saldo] = await Promise.all([
    prisma.cuentaCliente.findMany({ where: { ferreteriaId, clienteId: params.id }, orderBy: { createdAt: "asc" } }),
    calcularSaldoCliente(ferreteriaId, params.id),
  ]);

  return NextResponse.json({ cliente, movimientos, saldo });
}
