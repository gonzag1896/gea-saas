import { prisma } from "@/lib/db";
import type { crearCompraSchema } from "@/lib/schemas-compras";
import { aplicarMovimientoStock } from "@/lib/stock";
import { auditar } from "@/lib/auditoria";
import { EntidadNoEncontradaError, EstadoInvalidoError, CantidadInvalidaError } from "@/lib/errores-dominio";
import type { z } from "zod";

// Alta y confirmación en un solo paso: mismo criterio que
// crearVentaConfirmada() en @/lib/ventas — el negocio pidió sacar el
// estado Pendiente del flujo normal, una compra se carga una sola vez.
export async function crearCompraConfirmada(
  ferreteriaId: string,
  usuarioId: string,
  datos: z.infer<typeof crearCompraSchema>,
) {
  // l.descuento son puntos porcentuales (0-100), igual criterio que
  // VentaDetalle — se aplica sobre cantidad*costoUnitario antes de sumar
  // subtotal e IVA de la línea.
  const netoLinea = (l: (typeof datos.detalle)[number]) => l.cantidad * l.costoUnitario * (1 - l.descuento / 100);
  const subtotal = datos.detalle.reduce((acc, l) => acc + netoLinea(l), 0);
  const iva = datos.detalle.reduce((acc, l) => acc + (l.tipoIva === "TOTAL" ? netoLinea(l) * 0.22 : 0), 0);
  const fecha = new Date(datos.fecha);

  const compra = await prisma.$transaction(async (tx) => {
    const compra = await tx.compra.create({
      data: {
        ferreteriaId,
        proveedorId: datos.proveedorId,
        fecha,
        numeroFactura: datos.numeroFactura || undefined,
        facturaPdfUrl: datos.facturaPdfUrl || undefined,
        observaciones: datos.observaciones,
        registradoPorUsuarioId: usuarioId,
        estado: "CONFIRMADO",
        medioPago: datos.medioPago,
        subtotal,
        iva,
        total: subtotal + iva,
        detalle: {
          create: datos.detalle.map((l) => ({
            productoId: l.productoId,
            cantidad: l.cantidad,
            costoUnitario: l.costoUnitario,
            descuento: l.descuento,
            tipoIva: l.tipoIva,
            subtotal: netoLinea(l),
          })),
        },
      },
      include: { detalle: true },
    });

    for (const linea of compra.detalle) {
      // Puede tirar StockInsuficienteError en teoría (no debería pasar en
      // una ENTRADA, pero aplicarMovimientoStock es el mismo punto único
      // para ambos sentidos) — revierte toda la transacción si pasa.
      await aplicarMovimientoStock(tx, {
        ferreteriaId,
        productoId: linea.productoId,
        tipo: "ENTRADA",
        cantidad: linea.cantidad,
        fecha: compra.fecha,
        origenTipo: "COMPRA",
        origenId: compra.id,
        registradoPorUsuarioId: usuarioId,
      });
      await tx.producto.update({
        where: { id_ferreteriaId: { id: linea.productoId, ferreteriaId } },
        data: { precioCosto: linea.costoUnitario, fechaUltCompra: compra.fecha },
      });
    }

    if (compra.medioPago === "CREDITO") {
      await tx.cuentaProveedor.create({
        data: {
          ferreteriaId,
          proveedorId: compra.proveedorId,
          fecha: compra.fecha,
          debe: compra.total,
          haber: 0,
          origenTipo: "COMPRA_CREDITO",
          origenId: compra.id,
          registradoPorUsuarioId: usuarioId,
        },
      });
    }

    return compra;
  });

  await auditar({ accion: "COMPRA_CREA", usuarioId, ferreteriaId, entidad: "Compra", entidadId: compra.id });

  return compra;
}

// AltaMovimientoCompra del sistema original: entrada de stock por línea +
// actualización de costo y fecha de última compra del producto, todo en
// una transacción. El guard `estado: "PENDIENTE"` en el update es lo que
// hace que dos confirmaciones simultáneas de la misma compra no dupliquen
// el movimiento — la segunda llega con la fila ya en CONFIRMADO y no
// actualiza nada (count 0).
export async function confirmarCompra(ferreteriaId: string, compraId: string, usuarioId: string) {
  await prisma.$transaction(async (tx) => {
    const { count } = await tx.compra.updateMany({
      where: { id: compraId, ferreteriaId, estado: "PENDIENTE" },
      data: { estado: "CONFIRMADO" },
    });
    if (count === 0) {
      const existe = await tx.compra.findUnique({ where: { id_ferreteriaId: { id: compraId, ferreteriaId } } });
      throw existe
        ? new EstadoInvalidoError("La compra ya fue confirmada o anulada.")
        : new EntidadNoEncontradaError("Compra no encontrada.");
    }

    const compra = await tx.compra.findUniqueOrThrow({
      where: { id_ferreteriaId: { id: compraId, ferreteriaId } },
      include: { detalle: true },
    });

    for (const linea of compra.detalle) {
      await aplicarMovimientoStock(tx, {
        ferreteriaId,
        productoId: linea.productoId,
        tipo: "ENTRADA",
        cantidad: linea.cantidad,
        fecha: compra.fecha,
        origenTipo: "COMPRA",
        origenId: compra.id,
        registradoPorUsuarioId: usuarioId,
      });
      await tx.producto.update({
        where: { id_ferreteriaId: { id: linea.productoId, ferreteriaId } },
        data: { precioCosto: linea.costoUnitario, fechaUltCompra: compra.fecha },
      });
    }
  });

  await auditar({ accion: "COMPRA_CONFIRMA", usuarioId, ferreteriaId, entidad: "Compra", entidadId: compraId });
}

// AnularCompra: revierte la entrada de stock SOLO si la compra llegó a
// confirmarse (una compra Pendiente anulada nunca tocó el stock). Dos
// updateMany en vez de un findUnique + update: cuál de los dos matchea
// (CONFIRMADO o PENDIENTE) es al mismo tiempo el guard atómico contra
// doble anulación Y la forma de saber si hay que revertir stock, sin la
// ventana de carrera de un "leer estado, después decidir, después
// escribir" en pasos separados.
export async function anularCompra(ferreteriaId: string, compraId: string, usuarioId: string, motivo: string) {
  const datosAnulacion = { estado: "ANULADO" as const, anuladoPorUsuarioId: usuarioId, anuladoAt: new Date(), motivoAnulacion: motivo };

  await prisma.$transaction(async (tx) => {
    const anulaConfirmada = await tx.compra.updateMany({ where: { id: compraId, ferreteriaId, estado: "CONFIRMADO" }, data: datosAnulacion });

    const habiaConfirmada = anulaConfirmada.count === 1;
    if (!habiaConfirmada) {
      const anulaPendiente = await tx.compra.updateMany({ where: { id: compraId, ferreteriaId, estado: "PENDIENTE" }, data: datosAnulacion });
      if (anulaPendiente.count === 0) {
        const existe = await tx.compra.findUnique({ where: { id_ferreteriaId: { id: compraId, ferreteriaId } } });
        throw existe
          ? new EstadoInvalidoError("La compra ya estaba anulada.")
          : new EntidadNoEncontradaError("Compra no encontrada.");
      }
    }

    if (habiaConfirmada) {
      const compra = await tx.compra.findUniqueOrThrow({ where: { id_ferreteriaId: { id: compraId, ferreteriaId } } });
      const detalle = await tx.compraDetalle.findMany({ where: { compraId, ferreteriaId }, include: { devoluciones: true } });
      let montoARevertir = 0;
      for (const linea of detalle) {
        // Si la línea ya tuvo una devolución parcial, esas unidades salieron
        // por un movimiento aparte que ya quedó registrado — revertir de
        // nuevo la cantidad ORIGINAL duplicaría esa salida. Lo que hay que
        // revertir es lo que efectivamente sigue en stock por esta compra:
        // cantidad comprada menos lo ya devuelto.
        const yaDevuelto = linea.devoluciones.reduce((acc, d) => acc + d.cantidad, 0);
        const cantidadARevertir = linea.cantidad - yaDevuelto;
        if (cantidadARevertir <= 0) continue;

        await aplicarMovimientoStock(tx, {
          ferreteriaId,
          productoId: linea.productoId,
          tipo: "SALIDA",
          cantidad: cantidadARevertir,
          fecha: new Date(),
          motivo: "Anulación de compra",
          origenTipo: "COMPRA",
          origenId: compraId,
          registradoPorUsuarioId: usuarioId,
        });
        montoARevertir += cantidadARevertir * Number(linea.costoUnitario) * (1 - Number(linea.descuento) / 100);
      }

      if (compra.medioPago === "CREDITO" && montoARevertir > 0) {
        await tx.cuentaProveedor.create({
          data: {
            ferreteriaId,
            proveedorId: compra.proveedorId,
            fecha: new Date(),
            debe: 0,
            haber: montoARevertir,
            origenTipo: "ANULACION_COMPRA_CREDITO",
            origenId: compraId,
            registradoPorUsuarioId: usuarioId,
          },
        });
      }
    }
  });

  await auditar({ accion: "COMPRA_ANULA", usuarioId, ferreteriaId, entidad: "Compra", entidadId: compraId, detalle: { motivo } });
}

// Devolución de mercadería a un proveedor, línea por línea. No hay columna
// "cantidadDevuelta" en CompraDetalle (a diferencia de VentaDetalle): se
// suma lo ya devuelto desde el propio historial de DevolucionCompra, que
// es la fuente de verdad — mismo criterio que el resto del sistema
// (append-only, nunca un contador que se pueda desincronizar).
export async function registrarDevolucionCompra(
  ferreteriaId: string,
  compraDetalleId: string,
  cantidad: number,
  motivo: string | undefined,
  usuarioId: string,
) {
  const devolucion = await prisma.$transaction(async (tx) => {
    const linea = await tx.compraDetalle.findUnique({
      where: { id_ferreteriaId: { id: compraDetalleId, ferreteriaId } },
      include: { compra: true, devoluciones: true },
    });
    if (!linea) throw new EntidadNoEncontradaError("Línea de compra no encontrada.");
    if (linea.compra.estado !== "CONFIRMADO") {
      throw new EstadoInvalidoError("Solo se puede devolver mercadería de una compra confirmada.");
    }

    const yaDevuelto = linea.devoluciones.reduce((acc, d) => acc + d.cantidad, 0);
    if (yaDevuelto + cantidad > linea.cantidad) {
      throw new CantidadInvalidaError("La cantidad a devolver supera lo comprado en esa línea.");
    }

    await aplicarMovimientoStock(tx, {
      ferreteriaId,
      productoId: linea.productoId,
      tipo: "SALIDA",
      cantidad,
      fecha: new Date(),
      motivo,
      origenTipo: "DEVOLUCION_COMPRA",
      origenId: compraDetalleId,
      registradoPorUsuarioId: usuarioId,
    });

    if (linea.compra.medioPago === "CREDITO") {
      const montoDevuelto = cantidad * Number(linea.costoUnitario) * (1 - Number(linea.descuento) / 100);
      await tx.cuentaProveedor.create({
        data: {
          ferreteriaId,
          proveedorId: linea.compra.proveedorId,
          fecha: new Date(),
          debe: 0,
          haber: montoDevuelto,
          origenTipo: "DEVOLUCION_COMPRA",
          origenId: compraDetalleId,
          registradoPorUsuarioId: usuarioId,
        },
      });
    }

    return tx.devolucionCompra.create({
      data: { ferreteriaId, compraDetalleId, cantidad, motivo, registradoPorUsuarioId: usuarioId },
    });
  });

  await auditar({
    accion: "DEVOLUCION_COMPRA",
    usuarioId,
    ferreteriaId,
    entidad: "CompraDetalle",
    entidadId: compraDetalleId,
    detalle: { cantidad, motivo },
  });

  return devolucion;
}
