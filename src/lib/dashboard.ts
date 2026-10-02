import { prisma } from "@/lib/db";

// Todas las agregaciones filtran estado=CONFIRMADO a propósito: una venta
// o compra Pendiente o Anulada no es plata que entró o salió de verdad,
// así que no debe aparecer en ningún total del dashboard.
//
// Pesos y dólares se devuelven siempre por separado (nunca convertidos ni
// sumados entre sí) — mismo criterio que Venta/Compra/Cuenta Corriente/Caja.

export type MontoPorMoneda = { uyu: number; usd: number };

export async function totalVentasDelMes(ferreteriaId: string): Promise<MontoPorMoneda> {
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const resultado = await prisma.venta.aggregate({
    where: { ferreteriaId, estado: "CONFIRMADO", fecha: { gte: inicioMes } },
    _sum: { totalUYU: true, totalUSD: true },
  });
  return { uyu: Number(resultado._sum.totalUYU ?? 0), usd: Number(resultado._sum.totalUSD ?? 0) };
}

export async function totalComprasDelMes(ferreteriaId: string): Promise<MontoPorMoneda> {
  const ahora = new Date();
  const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
  const resultado = await prisma.compra.aggregate({
    where: { ferreteriaId, estado: "CONFIRMADO", fecha: { gte: inicioMes } },
    _sum: { totalUYU: true, totalUSD: true },
  });
  return { uyu: Number(resultado._sum.totalUYU ?? 0), usd: Number(resultado._sum.totalUSD ?? 0) };
}

export async function totalVentasHoy(ferreteriaId: string): Promise<MontoPorMoneda> {
  const hoy = new Date();
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const resultado = await prisma.venta.aggregate({
    where: { ferreteriaId, estado: "CONFIRMADO", fecha: { gte: inicioHoy } },
    _sum: { totalUYU: true, totalUSD: true },
  });
  return { uyu: Number(resultado._sum.totalUYU ?? 0), usd: Number(resultado._sum.totalUSD ?? 0) };
}

export async function totalComprasHoy(ferreteriaId: string): Promise<MontoPorMoneda> {
  const hoy = new Date();
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  const resultado = await prisma.compra.aggregate({
    where: { ferreteriaId, estado: "CONFIRMADO", fecha: { gte: inicioHoy } },
    _sum: { totalUYU: true, totalUSD: true },
  });
  return { uyu: Number(resultado._sum.totalUYU ?? 0), usd: Number(resultado._sum.totalUSD ?? 0) };
}

// Suma solo los saldos positivos de cada moneda (lo que cada cliente debe)
// — un cliente con saldo a favor (pagó de más) no puede "compensar" lo que
// debe otro, así que no alcanza con un solo aggregate neto de toda la
// cartera.
export async function totalPorCobrar(ferreteriaId: string): Promise<MontoPorMoneda> {
  const porClienteYMoneda = await prisma.cuentaCliente.groupBy({
    by: ["clienteId", "moneda"],
    where: { ferreteriaId },
    _sum: { debe: true, haber: true },
  });
  return porClienteYMoneda.reduce(
    (acc, c) => {
      const saldo = Number(c._sum.debe ?? 0) - Number(c._sum.haber ?? 0);
      if (saldo <= 0) return acc;
      return c.moneda === "UYU" ? { ...acc, uyu: acc.uyu + saldo } : { ...acc, usd: acc.usd + saldo };
    },
    { uyu: 0, usd: 0 },
  );
}

export type ProductoStockBajo = { id: string; codigo: string; descripcion: string; stockActual: number; stockMinimo: number };

// El filtro (stockActual <= stockMinimo), el orden por faltante y el límite
// se resuelven en la base: con un catálogo de miles de productos, traerlos
// todos a Node solo para quedarse con 5 era el costo del dashboard. Se usa
// SQL crudo (parametrizado) porque Prisma no ordena por la resta de dos
// columnas.
export async function productosStockBajo(ferreteriaId: string, limite = 5): Promise<ProductoStockBajo[]> {
  return prisma.$queryRaw<ProductoStockBajo[]>`
    SELECT id, codigo, descripcion, "stockActual", "stockMinimo"
    FROM "Producto"
    WHERE "ferreteriaId" = ${ferreteriaId} AND activo AND "stockActual" <= "stockMinimo"
    ORDER BY ("stockActual" - "stockMinimo") ASC, descripcion ASC
    LIMIT ${limite}
  `;
}

export type PuntoVentasDiarias = { fecha: string; totalUYU: number; totalUSD: number };

export async function ventasDiarias(ferreteriaId: string, desde: Date, hasta: Date): Promise<PuntoVentasDiarias[]> {
  const ventas = await prisma.venta.findMany({
    where: { ferreteriaId, estado: "CONFIRMADO", fecha: { gte: desde, lte: hasta } },
    select: { fecha: true, totalUYU: true, totalUSD: true },
  });

  const porDia = new Map<string, { totalUYU: number; totalUSD: number }>();
  for (const v of ventas) {
    const clave = v.fecha.toISOString().slice(0, 10);
    const actual = porDia.get(clave) ?? { totalUYU: 0, totalUSD: 0 };
    porDia.set(clave, { totalUYU: actual.totalUYU + Number(v.totalUYU), totalUSD: actual.totalUSD + Number(v.totalUSD) });
  }

  return Array.from(porDia.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, t]) => ({ fecha, ...t }));
}

export type PuntoComprasPorProveedor = { proveedor: string; totalUYU: number; totalUSD: number };

export async function comprasPorProveedor(ferreteriaId: string, desde: Date, hasta: Date): Promise<PuntoComprasPorProveedor[]> {
  const agrupado = await prisma.compra.groupBy({
    by: ["proveedorId"],
    where: { ferreteriaId, estado: "CONFIRMADO", fecha: { gte: desde, lte: hasta } },
    _sum: { totalUYU: true, totalUSD: true },
  });
  if (agrupado.length === 0) return [];

  const proveedores = await prisma.proveedor.findMany({
    where: { id: { in: agrupado.map((a) => a.proveedorId) } },
    select: { id: true, nombre: true },
  });
  const nombrePorId = new Map(proveedores.map((p) => [p.id, p.nombre]));

  return agrupado
    .map((a) => ({ proveedor: nombrePorId.get(a.proveedorId) ?? "—", totalUYU: Number(a._sum.totalUYU ?? 0), totalUSD: Number(a._sum.totalUSD ?? 0) }))
    .sort((a, b) => b.totalUYU - a.totalUYU);
}

export type PuntoComprasDiarias = { fecha: string; totalUYU: number; totalUSD: number };

// Espejo de ventasDiarias — junto a ella arma el gráfico "Ventas vs
// Compras" que muestra de un vistazo si el margen del período fue sano.
export async function comprasDiarias(ferreteriaId: string, desde: Date, hasta: Date): Promise<PuntoComprasDiarias[]> {
  const compras = await prisma.compra.findMany({
    where: { ferreteriaId, estado: "CONFIRMADO", fecha: { gte: desde, lte: hasta } },
    select: { fecha: true, totalUYU: true, totalUSD: true },
  });

  const porDia = new Map<string, { totalUYU: number; totalUSD: number }>();
  for (const c of compras) {
    const clave = c.fecha.toISOString().slice(0, 10);
    const actual = porDia.get(clave) ?? { totalUYU: 0, totalUSD: 0 };
    porDia.set(clave, { totalUYU: actual.totalUYU + Number(c.totalUYU), totalUSD: actual.totalUSD + Number(c.totalUSD) });
  }

  return Array.from(porDia.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([fecha, t]) => ({ fecha, ...t }));
}

export type PuntoMedioPago = { medioPago: string; totalUYU: number; totalUSD: number };

// Cuánto de lo vendido es plata que ya entró (Contado/Transferencia) vs.
// plata que todavía es una promesa de pago (Crédito) — clave para
// planificar flujo de caja, no solo "cuánto se vendió".
export async function ventasPorMedioPago(ferreteriaId: string, desde: Date, hasta: Date): Promise<PuntoMedioPago[]> {
  const agrupado = await prisma.venta.groupBy({
    by: ["medioPago"],
    where: { ferreteriaId, estado: "CONFIRMADO", fecha: { gte: desde, lte: hasta } },
    _sum: { totalUYU: true, totalUSD: true },
  });

  return agrupado
    .map((a) => ({ medioPago: a.medioPago as string, totalUYU: Number(a._sum.totalUYU ?? 0), totalUSD: Number(a._sum.totalUSD ?? 0) }))
    .sort((a, b) => b.totalUYU - a.totalUYU);
}

export type PuntoProductoVendido = { producto: string; cantidad: number; totalUYU: number; totalUSD: number };

// Ranking por plata generada en pesos (no por unidades) — orienta
// reposición y negociación con proveedores hacia lo que de verdad mueve la
// caja. Se agrupa por producto Y moneda (un mismo producto puede haberse
// vendido alguna vez en pesos y otra en dólares) y se fusiona antes de
// ordenar — el ranking usa el total en pesos como criterio principal.
export async function topProductosVendidos(ferreteriaId: string, desde: Date, hasta: Date, limite = 5): Promise<PuntoProductoVendido[]> {
  const agrupado = await prisma.ventaDetalle.groupBy({
    by: ["productoId", "moneda"],
    where: { ferreteriaId, venta: { estado: "CONFIRMADO", fecha: { gte: desde, lte: hasta } } },
    _sum: { cantidad: true, totalVigente: true },
  });
  if (agrupado.length === 0) return [];

  const porProducto = new Map<string, { cantidad: number; totalUYU: number; totalUSD: number }>();
  for (const a of agrupado) {
    const actual = porProducto.get(a.productoId) ?? { cantidad: 0, totalUYU: 0, totalUSD: 0 };
    actual.cantidad += a._sum.cantidad ?? 0;
    if (a.moneda === "UYU") actual.totalUYU += Number(a._sum.totalVigente ?? 0);
    else actual.totalUSD += Number(a._sum.totalVigente ?? 0);
    porProducto.set(a.productoId, actual);
  }

  const productos = await prisma.producto.findMany({
    where: { id: { in: Array.from(porProducto.keys()) } },
    select: { id: true, descripcion: true },
  });
  const nombrePorId = new Map(productos.map((p) => [p.id, p.descripcion]));

  return Array.from(porProducto.entries())
    .map(([productoId, t]) => ({ producto: nombrePorId.get(productoId) ?? "—", ...t }))
    .sort((a, b) => b.totalUYU - a.totalUYU)
    .slice(0, limite);
}
