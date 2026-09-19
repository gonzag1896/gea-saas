import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";
import { responderReporte, type ColumnaReporte } from "@/lib/reportes";

type FilaMovimiento = {
  fecha: Date;
  producto: string;
  tipo: string;
  cantidad: number;
  origen: string;
  motivo: string;
};

const ETIQUETA_TIPO: Record<string, string> = {
  ENTRADA: "Entrada",
  SALIDA: "Salida",
  AJUSTE_POSITIVO: "Ajuste (+)",
  AJUSTE_NEGATIVO: "Ajuste (−)",
};

const ETIQUETA_ORIGEN: Record<string, string> = {
  COMPRA: "Compra",
  VENTA: "Venta",
  AJUSTE: "Ajuste manual",
  DEVOLUCION_COMPRA: "Devolución de compra",
  DEVOLUCION_VENTA: "Devolución de venta",
};

const COLUMNAS: ColumnaReporte<FilaMovimiento>[] = [
  { header: "Fecha", value: (m) => m.fecha.toLocaleDateString("es-UY"), anchoExcel: 14, anchoPdf: 60 },
  { header: "Producto", value: (m) => m.producto, anchoExcel: 34, anchoPdf: 150 },
  { header: "Tipo", value: (m) => m.tipo, anchoExcel: 14, anchoPdf: 60 },
  { header: "Cantidad", value: (m) => m.cantidad, anchoExcel: 12, anchoPdf: 55, alineacion: "right" },
  { header: "Origen", value: (m) => m.origen, anchoExcel: 20, anchoPdf: 90 },
  { header: "Motivo", value: (m) => m.motivo, anchoExcel: 30, anchoPdf: 110 },
];

export async function GET(req: Request) {
  const resultado = await requirePermiso("stock", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const movimientosRaw = await prisma.movimientoStock.findMany({
    where: { ferreteriaId: resultado.contexto.ferreteriaId },
    include: { producto: { select: { codigo: true, descripcion: true } } },
    orderBy: { createdAt: "desc" },
    take: 1000,
  });

  const filas: FilaMovimiento[] = movimientosRaw.map((m) => ({
    fecha: m.fecha,
    producto: `${m.producto.codigo} — ${m.producto.descripcion}`,
    tipo: ETIQUETA_TIPO[m.tipo] ?? m.tipo,
    cantidad: m.cantidad,
    origen: ETIQUETA_ORIGEN[m.origenTipo] ?? m.origenTipo,
    motivo: m.motivo ?? "—",
  }));

  const { searchParams } = new URL(req.url);
  return responderReporte(
    searchParams.get("formato"),
    "movimiento-stock",
    "Movimiento de Stock",
    `${resultado.contexto.ferreteriaNombre} · ${filas.length} movimientos (últimos 1000)`,
    COLUMNAS,
    filas,
  );
}
