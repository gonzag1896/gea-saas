import { prisma } from "@/lib/db";
import { aplicarMovimientoStock } from "@/lib/stock";
import { auditar } from "@/lib/auditoria";
import { EntidadNoEncontradaError, EstadoInvalidoError, CantidadInvalidaError } from "@/lib/errores-dominio";

// AltaMovimientoVenta del sistema original: salida de stock por línea (que
// puede rechazar la confirmación entera si no hay stock — decisión
// pendiente #1 del informe, cerrada: se bloquea vender sin stock) y, si el
// medio de pago es Crédito, un asiento Debe en la cuenta corriente del
// cliente por el total de la venta.
export async function confirmarVenta(ferreteriaId: string, ventaId: string, usuarioId: string) {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.venta.updateMany({
      where: { id: ventaId, ferreteriaId, estado: "PENDIENTE" },
      data: { estado: "CONFIRMADO" },
    });
    if (count === 0) {
      const existe = await tx.venta.findUnique({ where: { id_ferreteriaId: { id: ventaId, ferreteriaId } } });
      throw existe
        ? new EstadoInvalidoError("La venta ya fue confirmada o anulada.")
        : new EntidadNoEncontradaError("Venta no encontrada.");
    }

    const venta = await tx.venta.findUniqueOrThrow({
      where: { id_ferreteriaId: { id: ventaId, ferreteriaId } },
      include: { detalle: true },
    });

    for (const linea of venta.detalle) {
      // Puede tirar StockInsuficienteError, lo que revierte toda la
      // transacción — incluida la propia confirmación de arriba.
      await aplicarMovimientoStock(tx, {
        ferreteriaId,
        productoId: linea.productoId,
        tipo: "SALIDA",
        cantidad: linea.cantidad,
        fecha: venta.fecha,
        origenTipo: "VENTA",
        origenId: venta.id,
        registradoPorUsuarioId: usuarioId,
      });
    }

    if (venta.medioPago === "CREDITO") {
      await tx.cuentaCliente.create({
        data: {
          ferreteriaId,
          clienteId: venta.clienteId,
          fecha: venta.fecha,
          debe: venta.total,
          haber: 0,
          origenTipo: "VENTA_CREDITO",
          origenId: venta.id,
          registradoPorUsuarioId: usuarioId,
        },
      });
    }
  });

  await auditar({ accion: "VENTA_CONFIRMA", usuarioId, ferreteriaId, entidad: "Venta", entidadId: ventaId });
}

// AnularVenta: revierte SOLO lo que sigue vigente de esta venta, no lo
// original — mismo criterio (y mismo bug ya encontrado una vez en
// Compras, sección Fase 7) aplicado desde el principio acá:
//
//  - Stock: se repone cantidad - cantidadDevuelta por línea, no la
//    cantidad vendida original (lo devuelto ya volvió al stock aparte,
//    por su propia devolución).
//  - Cuenta corriente: si la venta era a Crédito, el Haber que revierte
//    es la suma de totalVigente de las líneas (el total original ya
//    neto de cualquier devolución previa), no venta.total — si no, una
//    devolución ya acreditada se estaría acreditando dos veces.
export async function anularVenta(ferreteriaId: string, ventaId: string, usuarioId: string, motivo: string) {
  const datosAnulacion = { estado: "ANULADO" as const, anuladoPorUsuarioId: usuarioId, anuladoAt: new Date(), motivoAnulacion: motivo };

  await prisma.$transaction(async (tx) => {
    const anulaConfirmada = await tx.venta.updateMany({ where: { id: ventaId, ferreteriaId, estado: "CONFIRMADO" }, data: datosAnulacion });

    const habiaConfirmada = anulaConfirmada.count === 1;
    if (!habiaConfirmada) {
      const anulaPendiente = await tx.venta.updateMany({ where: { id: ventaId, ferreteriaId, estado: "PENDIENTE" }, data: datosAnulacion });
      if (anulaPendiente.count === 0) {
        const existe = await tx.venta.findUnique({ where: { id_ferreteriaId: { id: ventaId, ferreteriaId } } });
        throw existe
          ? new EstadoInvalidoError("La venta ya estaba anulada.")
          : new EntidadNoEncontradaError("Venta no encontrada.");
      }
    }

    if (!habiaConfirmada) return;

    const venta = await tx.venta.findUniqueOrThrow({
      where: { id_ferreteriaId: { id: ventaId, ferreteriaId } },
      include: { detalle: true },
    });

    let montoARevertir = 0;
    for (const linea of venta.detalle) {
      const cantidadNeta = linea.cantidad - linea.cantidadDevuelta;
      if (cantidadNeta > 0) {
        await aplicarMovimientoStock(tx, {
          ferreteriaId,
          productoId: linea.productoId,
          tipo: "ENTRADA",
          cantidad: cantidadNeta,
          fecha: new Date(),
          motivo: "Anulación de venta",
          origenTipo: "VENTA",
          origenId: ventaId,
          registradoPorUsuarioId: usuarioId,
        });
      }
      montoARevertir += Number(linea.totalVigente);
    }

    if (venta.medioPago === "CREDITO" && montoARevertir > 0) {
      await tx.cuentaCliente.create({
        data: {
          ferreteriaId,
          clienteId: venta.clienteId,
          fecha: new Date(),
          debe: 0,
          haber: montoARevertir,
          origenTipo: "ANULACION_VENTA_CREDITO",
          origenId: ventaId,
          registradoPorUsuarioId: usuarioId,
        },
      });
    }
  });

  await auditar({ accion: "VENTA_ANULA", usuarioId, ferreteriaId, entidad: "Venta", entidadId: ventaId, detalle: { motivo } });
}

// Devolución parcial por línea. A diferencia de CompraDetalle, VentaDetalle
// sí tiene cantidadDevuelta (columna persistida, con CHECK cantidadDevuelta
// <= cantidad) — se actualiza acá en vez de sumarse desde un historial,
// porque totalVigente (el otro campo que se ajusta) tampoco tendría de
// dónde salir si no.
export async function registrarDevolucionVenta(
  ferreteriaId: string,
  ventaDetalleId: string,
  cantidad: number,
  motivo: string | undefined,
  usuarioId: string,
) {
  const devolucion = await prisma.$transaction(async (tx) => {
    const linea = await tx.ventaDetalle.findUnique({
      where: { id_ferreteriaId: { id: ventaDetalleId, ferreteriaId } },
      include: { venta: true },
    });
    if (!linea) throw new EntidadNoEncontradaError("Línea de venta no encontrada.");
    if (linea.venta.estado !== "CONFIRMADO") {
      throw new EstadoInvalidoError("Solo se puede devolver mercadería de una venta confirmada.");
    }
    if (linea.cantidadDevuelta + cantidad > linea.cantidad) {
      throw new CantidadInvalidaError("La cantidad a devolver supera lo vendido en esa línea.");
    }

    // Proporcional al total de la línea — no se asume una fórmula de
    // descuento particular más allá de la que ya calculó la venta.
    const montoDevuelto = (Number(linea.total) * cantidad) / linea.cantidad;

    await aplicarMovimientoStock(tx, {
      ferreteriaId,
      productoId: linea.productoId,
      tipo: "ENTRADA",
      cantidad,
      fecha: new Date(),
      motivo,
      origenTipo: "DEVOLUCION_VENTA",
      origenId: ventaDetalleId,
      registradoPorUsuarioId: usuarioId,
    });

    await tx.ventaDetalle.update({
      where: { id_ferreteriaId: { id: ventaDetalleId, ferreteriaId } },
      data: { cantidadDevuelta: { increment: cantidad }, totalVigente: { decrement: montoDevuelto } },
    });

    if (linea.venta.medioPago === "CREDITO") {
      await tx.cuentaCliente.create({
        data: {
          ferreteriaId,
          clienteId: linea.venta.clienteId,
          fecha: new Date(),
          debe: 0,
          haber: montoDevuelto,
          origenTipo: "DEVOLUCION_VENTA",
          origenId: ventaDetalleId,
          registradoPorUsuarioId: usuarioId,
        },
      });
    }

    return tx.devolucionVenta.create({
      data: { ferreteriaId, ventaDetalleId, cantidad, motivo, registradoPorUsuarioId: usuarioId },
    });
  });

  await auditar({
    accion: "DEVOLUCION_VENTA",
    usuarioId,
    ferreteriaId,
    entidad: "VentaDetalle",
    entidadId: ventaDetalleId,
    detalle: { cantidad, motivo },
  });

  return devolucion;
}
