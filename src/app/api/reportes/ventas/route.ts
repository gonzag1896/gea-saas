import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";
import { responderReporte, type ColumnaReporte } from "@/lib/reportes";
import { formatearFecha } from "@/lib/fecha";

type FilaVenta = {
  fecha: Date;
  cliente: string;
  medioPago: string;
  estado: string;
  total: number;
};

const COLUMNAS: ColumnaReporte<FilaVenta>[] = [
  { header: "Fecha", value: (v) => formatearFecha(v.fecha), anchoExcel: 14, anchoPdf: 70 },
  { header: "Cliente", value: (v) => v.cliente, anchoExcel: 30, anchoPdf: 160 },
  { header: "Medio de pago", value: (v) => v.medioPago, anchoExcel: 16, anchoPdf: 90 },
  { header: "Estado", value: (v) => v.estado, anchoExcel: 14, anchoPdf: 70 },
  { header: "Total", value: (v) => v.total, anchoExcel: 14, anchoPdf: 70, alineacion: "right" },
];

export async function GET(req: Request) {
  const resultado = await requirePermiso("ventas", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const ventasRaw = await prisma.venta.findMany({
    where: { ferreteriaId: resultado.contexto.ferreteriaId },
    select: { fecha: true, estado: true, medioPago: true, total: true, cliente: { select: { nombre: true } } },
    orderBy: { fecha: "desc" },
  });

  const filas: FilaVenta[] = ventasRaw.map((v) => ({
    fecha: v.fecha,
    cliente: v.cliente.nombre,
    medioPago: v.medioPago,
    estado: v.estado,
    total: Number(v.total),
  }));

  const { searchParams } = new URL(req.url);
  return responderReporte(
    searchParams.get("formato"),
    "ventas",
    "Ventas",
    `${resultado.contexto.ferreteriaNombre} · ${filas.length} ventas`,
    COLUMNAS,
    filas,
  );
}
