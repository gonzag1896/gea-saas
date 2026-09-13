import type { Prisma, TipoMovimientoStock, OrigenMovimientoStock } from "@prisma/client";
import { prisma } from "@/lib/db";
import { auditar } from "@/lib/auditoria";

type TxClient = Prisma.TransactionClient;

// Se lanza cuando una SALIDA (venta, anulación de compra, devolución de
// compra, ajuste negativo) dejaría el stock en negativo. Quien llama debe
// dejarla propagar dentro de la misma transacción para que todo lo demás
// (la compra/venta que la disparó) se revierta también.
export class StockInsuficienteError extends Error {
  readonly productoId: string;
  constructor(productoId: string) {
    // Sin el id crudo en el mensaje: en todas las pantallas donde se ve
    // este error el usuario ya está parado sobre el producto en cuestión
    // (la línea de la venta, la página del producto) — mostrar el id
    // interno no agrega información, solo ruido.
    super("Stock insuficiente para completar esta operación.");
    this.name = "StockInsuficienteError";
    this.productoId = productoId;
  }
}

export type ParametrosMovimientoStock = {
  ferreteriaId: string;
  productoId: string;
  tipo: TipoMovimientoStock;
  cantidad: number; // siempre positivo — el signo lo da `tipo`, no el número
  fecha: Date;
  motivo?: string;
  origenTipo: OrigenMovimientoStock;
  origenId?: string;
  registradoPorUsuarioId?: string;
};

// Único punto que toca Producto.stockActual — StockProcesarMovimiento del
// sistema original. Debe llamarse siempre dentro de la transacción del
// caso de uso que lo dispara (confirmarCompra, confirmarVenta, anular*,
// ajustes), nunca suelto, para que stock y el resto de los cambios queden
// atómicos.
//
// La resta de una SALIDA es un único UPDATE con el guard `stockActual >=
// cantidad` (no un SELECT seguido de un UPDATE): eso es lo que evita la
// condición de carrera de dos ventas simultáneas del mismo producto —
// Postgres serializa esa fila, no hace falta un SELECT FOR UPDATE aparte.
export async function aplicarMovimientoStock(tx: TxClient, params: ParametrosMovimientoStock): Promise<void> {
  const esEntrada = params.tipo === "ENTRADA" || params.tipo === "AJUSTE_POSITIVO";

  if (esEntrada) {
    await tx.producto.update({
      where: { id_ferreteriaId: { id: params.productoId, ferreteriaId: params.ferreteriaId } },
      data: { stockActual: { increment: params.cantidad } },
    });
  } else {
    const { count } = await tx.producto.updateMany({
      where: { id: params.productoId, ferreteriaId: params.ferreteriaId, stockActual: { gte: params.cantidad } },
      data: { stockActual: { decrement: params.cantidad } },
    });
    if (count === 0) throw new StockInsuficienteError(params.productoId);
  }

  await tx.movimientoStock.create({
    data: {
      ferreteriaId: params.ferreteriaId,
      productoId: params.productoId,
      tipo: params.tipo,
      cantidad: params.cantidad,
      fecha: params.fecha,
      motivo: params.motivo,
      origenTipo: params.origenTipo,
      origenId: params.origenId,
      registradoPorUsuarioId: params.registradoPorUsuarioId,
    },
  });
}

// AjusteStockProducto del sistema original: la única vía para corregir
// stock "a mano" (diferencia de inventario, rotura, etc.) — a diferencia
// de compras/ventas, acá no hay nada más que ajustar, así que la
// transacción es solo aplicarMovimientoStock + su auditoría.
export async function registrarAjusteStock(
  ferreteriaId: string,
  productoId: string,
  tipo: "AJUSTE_POSITIVO" | "AJUSTE_NEGATIVO",
  cantidad: number,
  motivo: string,
  usuarioId: string,
) {
  await prisma.$transaction(async (tx) => {
    await aplicarMovimientoStock(tx, {
      ferreteriaId,
      productoId,
      tipo,
      cantidad,
      fecha: new Date(),
      motivo,
      origenTipo: "AJUSTE",
      registradoPorUsuarioId: usuarioId,
    });
  });

  await auditar({
    accion: "STOCK_AJUSTE",
    usuarioId,
    ferreteriaId,
    entidad: "Producto",
    entidadId: productoId,
    detalle: { tipo, cantidad, motivo },
  });
}
