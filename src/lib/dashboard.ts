import { prisma } from "@/lib/db";

// Todas las agregaciones filtran estado=CONFIRMADO a propósito: una venta
// o compra Pendiente o Anulada no es plata que entró o salió de verdad,
// así que no debe aparecer en ningún total del dashboard.

export async function totalVentasDelMes(ferreteriaId: string): Promise<number> {
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const resultado = await prisma.venta.aggregate({
    where: { ferreteriaId, estado: "CONFIRMADO", fecha: { gte: inicioMes } },
    _sum: { total: true },
  });
  return Number(resultado._sum.total ?? 0);
}

export async function totalComprasDelMes(ferreteriaId: string): Promise<number> {
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const resultado = await prisma.compra.aggregate({
    where: { ferreteriaId, estado: "CONFIRMADO", fecha: { gte: inicioMes } },
    _sum: { total: true },
  });
  return Number(resultado._sum.total ?? 0);
}

export type PuntoVentasDiarias = { fecha: string; total: number };

export async function ventasDiarias(ferreteriaId: string, desde: Date, hasta: Date): Promise<PuntoVentasDiarias[]> {
  const ventas = await prisma.venta.findMany({
    where: { ferreteriaId, estado: "CONFIRMADO", fecha: { gte: desde, lte: hasta } },
    select: { fecha: true, total: true },
  });

  const porDia = new Map<string, number>();
  for (const v of ventas) {
    const clave = v.fecha.toISOString().slice(0, 10);
    porDia.set(clave, (porDia.get(clave) ?? 0) + Number(v.total));
  }

  return Array.from(porDia.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, total]) => ({ fecha, total }));
}

export type PuntoComprasPorProveedor = { proveedor: string; total: number };

export async function comprasPorProveedor(ferreteriaId: string, desde: Date, hasta: Date): Promise<PuntoComprasPorProveedor[]> {
  const agrupado = await prisma.compra.groupBy({
    by: ["proveedorId"],
    where: { ferreteriaId, estado: "CONFIRMADO", fecha: { gte: desde, lte: hasta } },
    _sum: { total: true },
  });
  if (agrupado.length === 0) return [];

  const proveedores = await prisma.proveedor.findMany({
    where: { id: { in: agrupado.map((a) => a.proveedorId) } },
    select: { id: true, nombre: true },
  });
  const nombrePorId = new Map(proveedores.map((p) => [p.id, p.nombre]));

  return agrupado
    .map((a) => ({ proveedor: nombrePorId.get(a.proveedorId) ?? "—", total: Number(a._sum.total ?? 0) }))
    .sort((a, b) => b.total - a.total);
}
