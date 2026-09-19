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

export async function totalVentasHoy(ferreteriaId: string): Promise<number> {
  const hoy = new Date();
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const resultado = await prisma.venta.aggregate({
    where: { ferreteriaId, estado: "CONFIRMADO", fecha: { gte: inicioHoy } },
    _sum: { total: true },
  });
  return Number(resultado._sum.total ?? 0);
}

// Suma solo los saldos positivos (lo que cada cliente debe) — un cliente
// con saldo a favor (pagó de más) no puede "compensar" lo que debe otro,
// así que no alcanza con un solo aggregate neto de toda la cartera.
export async function totalPorCobrar(ferreteriaId: string): Promise<number> {
  const porCliente = await prisma.cuentaCliente.groupBy({
    by: ["clienteId"],
    where: { ferreteriaId },
    _sum: { debe: true, haber: true },
  });
  return porCliente.reduce((acc, c) => {
    const saldo = Number(c._sum.debe ?? 0) - Number(c._sum.haber ?? 0);
    return saldo > 0 ? acc + saldo : acc;
  }, 0);
}

export type ProductoStockBajo = { id: string; codigo: string; descripcion: string; stockActual: number; stockMinimo: number };

// Trae solo los productos activos (catálogo de una ferretería no pasa de
// unos cientos de ítems) y filtra en memoria — Prisma no compara dos
// columnas de la misma fila (stockActual <= stockMinimo) en un `where`
// sin SQL crudo, y acá no hace falta.
export async function productosStockBajo(ferreteriaId: string, limite = 5): Promise<ProductoStockBajo[]> {
  const productos = await prisma.producto.findMany({
    where: { ferreteriaId, activo: true },
    select: { id: true, codigo: true, descripcion: true, stockActual: true, stockMinimo: true },
  });
  return productos
    .filter((p) => p.stockActual <= p.stockMinimo)
    .sort((a, b) => (a.stockActual - a.stockMinimo) - (b.stockActual - b.stockMinimo))
    .slice(0, limite);
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
