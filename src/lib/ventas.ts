import { prisma } from "@/lib/db";
import type { crearVentaSchema } from "@/lib/schemas-ventas";
import { aplicarMovimientoStock } from "@/lib/stock";
import { auditar } from "@/lib/auditoria";
import { EntidadNoEncontradaError, EstadoInvalidoError, CantidadInvalidaError } from "@/lib/errores-dominio";
import type { z } from "zod";

// Alta y confirmación en un solo paso: el negocio pidió sacar el estado
// Pendiente del flujo normal (una venta se carga una sola vez, no se
// registra y después se vuelve a confirmar aparte — eso era doble
// trabajo). Una venta nunca se bloquea por falta de stock: aplicarMovimientoStock
// permite que quede negativo para el origen VENTA (se corrige después con
// una compra o un ajuste), así que esta transacción no puede fallar por eso.
export async function crearVentaConfirmada(
  ferreteriaId: string,
  usuarioId: string,
  datos: z.infer<typeof crearVentaSchema>,
) {
  const lineas = datos.detalle.map((l) => ({ ...l, total: l.precio * l.cantidad * (1 - l.descuento / 100) }));
  const subtotal = lineas.reduce((acc, l) => acc + l.total, 0);
  const iva = datos.tipoIva === "TOTAL" ? subtotal * 0.22 : 0;
  const fecha = new Date(datos.fecha);

  const venta = await prisma.$transaction(async (tx) => {
    const venta = await tx.venta.create({
      data: {
        ferreteriaId,
        clienteId: datos.clienteId,
        fecha,
        tipoIva: datos.tipoIva,
        medioPago: datos.medioPago,
        entrega: datos.entrega,
        registradoPorUsuarioId: usuarioId,
        estado: "CONFIRMADO",
        subtotal,
        iva,
        total: subtotal + iva,
        detalle: {
          create: lineas.map((l) => ({
            productoId: l.productoId,
            cantidad: l.cantidad,
            precio: l.precio,
            descuento: l.descuento,
            total: l.total,
            totalVigente: l.total,
          })),
        },
      },
      include: { detalle: true },
    });

    for (const linea of venta.detalle) {
      // Salida sin guard de stock — ver aplicarMovimientoStock.
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

    return venta;
  });

  await auditar({ accion: "VENTA_CREA", usuarioId, ferreteriaId, entidad: "Venta", entidadId: venta.id });

  return venta;
}

// AltaMovimientoVenta del sistema original: salida de stock por línea (sin
// bloquear por falta de stock, ver aplicarMovimientoStock) y, si el medio
// de pago es Crédito, un asiento Debe en la cuenta corriente del cliente
// por el total de la venta.
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
      // Salida sin guard de stock — ver aplicarMovimientoStock.
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
