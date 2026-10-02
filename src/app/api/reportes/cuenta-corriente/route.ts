import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";
import { responderReporte, type ColumnaReporte } from "@/lib/reportes";

type FilaCuenta = {
  cliente: string;
  telefono: string;
  saldoUYU: number;
  saldoUSD: number;
};

const COLUMNAS: ColumnaReporte<FilaCuenta>[] = [
  { header: "Cliente", value: (f) => f.cliente, anchoExcel: 30, anchoPdf: 220 },
  { header: "Teléfono", value: (f) => f.telefono, anchoExcel: 18, anchoPdf: 110 },
  { header: "Saldo $", value: (f) => f.saldoUYU, anchoExcel: 14, anchoPdf: 90, alineacion: "right" },
  { header: "Saldo US$", value: (f) => f.saldoUSD, anchoExcel: 14, anchoPdf: 90, alineacion: "right" },
];

export async function GET(req: Request) {
  const resultado = await requirePermiso("cuentaCorriente", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const { ferreteriaId } = resultado.contexto;
  const [clientes, saldosPorClienteYMoneda] = await Promise.all([
    prisma.cliente.findMany({ where: { ferreteriaId }, select: { id: true, nombre: true, telefono: true }, orderBy: { nombre: "asc" } }),
    prisma.cuentaCliente.groupBy({ by: ["clienteId", "moneda"], where: { ferreteriaId }, _sum: { debe: true, haber: true } }),
  ]);

  const saldosUYU = new Map<string, number>();
  const saldosUSD = new Map<string, number>();
  for (const s of saldosPorClienteYMoneda) {
    const monto = Number(s._sum.debe ?? 0) - Number(s._sum.haber ?? 0);
    (s.moneda === "UYU" ? saldosUYU : saldosUSD).set(s.clienteId, monto);
  }
  const filas: FilaCuenta[] = clientes.map((c) => ({
    cliente: c.nombre,
    telefono: c.telefono ?? "—",
    saldoUYU: saldosUYU.get(c.id) ?? 0,
    saldoUSD: saldosUSD.get(c.id) ?? 0,
  }));

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
