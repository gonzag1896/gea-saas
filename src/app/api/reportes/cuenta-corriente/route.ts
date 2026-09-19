import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";
import { responderReporte, type ColumnaReporte } from "@/lib/reportes";

type FilaCuenta = {
  cliente: string;
  telefono: string;
  saldo: number;
};

const COLUMNAS: ColumnaReporte<FilaCuenta>[] = [
  { header: "Cliente", value: (f) => f.cliente, anchoExcel: 30, anchoPdf: 220 },
  { header: "Teléfono", value: (f) => f.telefono, anchoExcel: 18, anchoPdf: 110 },
  { header: "Saldo", value: (f) => f.saldo, anchoExcel: 14, anchoPdf: 90, alineacion: "right" },
];

export async function GET(req: Request) {
  const resultado = await requirePermiso("cuentaCorriente", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const { ferreteriaId } = resultado.contexto;
  const [clientes, saldosPorCliente] = await Promise.all([
    prisma.cliente.findMany({ where: { ferreteriaId }, select: { id: true, nombre: true, telefono: true }, orderBy: { nombre: "asc" } }),
    prisma.cuentaCliente.groupBy({ by: ["clienteId"], where: { ferreteriaId }, _sum: { debe: true, haber: true } }),
  ]);

  const saldos = new Map(saldosPorCliente.map((s) => [s.clienteId, Number(s._sum.debe ?? 0) - Number(s._sum.haber ?? 0)]));
  const filas: FilaCuenta[] = clientes.map((c) => ({ cliente: c.nombre, telefono: c.telefono ?? "—", saldo: saldos.get(c.id) ?? 0 }));

  const { searchParams } = new URL(req.url);
  return responderReporte(
    searchParams.get("formato"),
    "cuenta-corriente",
    "Cuenta Corriente",
    `${resultado.contexto.ferreteriaNombre} · ${filas.length} clientes`,
    COLUMNAS,
    filas,
  );
}
