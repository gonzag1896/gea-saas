import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";
import { responderReporte, type ColumnaReporte } from "@/lib/reportes";

type FilaCompra = {
  fecha: Date;
  proveedor: string;
  estado: string;
  total: number;
};

const COLUMNAS: ColumnaReporte<FilaCompra>[] = [
  { header: "Fecha", value: (c) => c.fecha.toLocaleDateString("es-UY"), anchoExcel: 14, anchoPdf: 90 },
  { header: "Proveedor", value: (c) => c.proveedor, anchoExcel: 32, anchoPdf: 220 },
  { header: "Estado", value: (c) => c.estado, anchoExcel: 14, anchoPdf: 90 },
  { header: "Total", value: (c) => c.total, anchoExcel: 14, anchoPdf: 90, alineacion: "right" },
];

export async function GET(req: Request) {
  const resultado = await requirePermiso("compras", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const comprasRaw = await prisma.compra.findMany({
    where: { ferreteriaId: resultado.contexto.ferreteriaId },
    select: { fecha: true, estado: true, total: true, proveedor: { select: { nombre: true } } },
    orderBy: { fecha: "desc" },
  });

  const filas: FilaCompra[] = comprasRaw.map((c) => ({
    fecha: c.fecha,
    proveedor: c.proveedor.nombre,
    estado: c.estado,
    total: Number(c.total),
  }));

  const { searchParams } = new URL(req.url);
  return responderReporte(
    searchParams.get("formato"),
    "compras",
    "Compras",
    `${resultado.contexto.ferreteriaNombre} · ${filas.length} compras`,
    COLUMNAS,
    filas,
  );
}
