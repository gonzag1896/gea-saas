import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { crearFerreteriaConUsuario, borrarFixture } from "@/lib/test-fixtures";
import { confirmarVenta, anularVenta, registrarDevolucionVenta, crearVentaConfirmada } from "@/lib/ventas";
import { EstadoInvalidoError, CantidadInvalidaError } from "@/lib/errores-dominio";

describe("ventas — confirmar, anular, devolución, cuenta corriente", () => {
  const sufijo = `ventas-${Date.now()}`;
  let ferreteria: { id: string };
  let dueno: { id: string };
  let clienteId: string;
  let productoId: string;

  beforeAll(async () => {
    ({ ferreteria, usuario: dueno } = await crearFerreteriaConUsuario(sufijo, "DUENO"));
    clienteId = (await prisma.cliente.create({ data: { ferreteriaId: ferreteria.id, nombre: "Cliente Test" } })).id;
    const categoria = await prisma.categoria.create({ data: { ferreteriaId: ferreteria.id, nombre: "Cat" } });
    const subCategoria = await prisma.subCategoria.create({ data: { ferreteriaId: ferreteria.id, categoriaId: categoria.id, nombre: "Sub" } });
    const marca = await prisma.marca.create({ data: { ferreteriaId: ferreteria.id, nombre: "Marca" } });
    productoId = (await prisma.producto.create({
      data: { ferreteriaId: ferreteria.id, codigo: "P-VENTA", descripcion: "Producto de prueba", subCategoriaId: subCategoria.id, marcaId: marca.id, stockActual: 100 },
    })).id;
  });

  afterAll(async () => {
    await prisma.cuentaCliente.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.movimientoStock.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.devolucionVenta.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.ventaDetalle.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.venta.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.cliente.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.producto.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await borrarFixture(ferreteria.id, [dueno.id]);
  });

  async function crearVentaPendiente(cantidad: number, precio: number, medioPago: "CONTADO" | "CREDITO" | "TRANSFERENCIA" = "CONTADO") {
    const total = cantidad * precio;
    return prisma.venta.create({
      data: {
        ferreteriaId: ferreteria.id,
        clienteId,
        fecha: new Date(),
        medioPago,
        subtotal: total,
        iva: 0,
        total,
        detalle: { create: [{ productoId, cantidad, precio, total, totalVigente: total }] },
      },
    });
  }

  async function stockDelProducto() {
    return (await prisma.producto.findUniqueOrThrow({ where: { id: productoId } })).stockActual;
  }

  it("confirmar descuenta stock", async () => {
    const antes = await stockDelProducto();
    const venta = await crearVentaPendiente(10, 100);
    await confirmarVenta(ferreteria.id, venta.id, dueno.id);
    expect(antes - (await stockDelProducto())).toBe(10);

    const movimiento = await prisma.movimientoStock.findFirst({ where: { origenTipo: "VENTA", origenId: venta.id } });
    expect(movimiento).toMatchObject({ tipo: "SALIDA", cantidad: 10 });
  });

  it("se puede vender más de lo que hay en stock — la venta se confirma y el stock queda negativo", async () => {
    const stockActual = await stockDelProducto();
    const cantidad = Math.max(stockActual, 0) + 5; // supera el stock disponible sea cual sea su signo
    const venta = await crearVentaPendiente(cantidad, 100);
    await confirmarVenta(ferreteria.id, venta.id, dueno.id);

    const ventaTrasConfirmar = await prisma.venta.findUniqueOrThrow({ where: { id: venta.id } });
    expect(ventaTrasConfirmar.estado).toBe("CONFIRMADO");
    expect(await stockDelProducto()).toBe(stockActual - cantidad);
  });

  it("confirmar dos veces la misma venta falla la segunda vez", async () => {
    const venta = await crearVentaPendiente(1, 50);
    await confirmarVenta(ferreteria.id, venta.id, dueno.id);
    await expect(confirmarVenta(ferreteria.id, venta.id, dueno.id)).rejects.toThrow(EstadoInvalidoError);
  });

  it("una venta CONTADO confirmada no genera ningún asiento en cuenta corriente", async () => {
    const venta = await crearVentaPendiente(2, 50, "CONTADO");
    await confirmarVenta(ferreteria.id, venta.id, dueno.id);
    const asientos = await prisma.cuentaCliente.findMany({ where: { origenId: venta.id } });
    expect(asientos).toEqual([]);
  });

  it("una venta CREDITO confirmada genera un Debe por el total, y anularla genera el Haber que la cancela", async () => {
    const venta = await crearVentaPendiente(4, 100, "CREDITO"); // total 400
    await confirmarVenta(ferreteria.id, venta.id, dueno.id);

    const debe = await prisma.cuentaCliente.findFirstOrThrow({ where: { origenTipo: "VENTA_CREDITO", origenId: venta.id } });
    expect(Number(debe.debe)).toBe(400);
    expect(Number(debe.haber)).toBe(0);

    await anularVenta(ferreteria.id, venta.id, dueno.id, "Cliente se arrepintió");

    const haber = await prisma.cuentaCliente.findFirstOrThrow({ where: { origenTipo: "ANULACION_VENTA_CREDITO", origenId: venta.id } });
    expect(Number(haber.haber)).toBe(400);

    const saldo = await prisma.cuentaCliente.aggregate({ where: { clienteId }, _sum: { debe: true, haber: true } });
    expect(Number(saldo._sum.debe) - Number(saldo._sum.haber)).toBe(0); // el saldo de este cliente queda en cero
  });

  it("anular repone el stock vendido", async () => {
    const antes = await stockDelProducto();
    const venta = await crearVentaPendiente(3, 100);
    await confirmarVenta(ferreteria.id, venta.id, dueno.id);
    await anularVenta(ferreteria.id, venta.id, dueno.id, "motivo");
    expect(await stockDelProducto()).toBe(antes);
  });

  it("devolución parcial repone stock y no deja devolver más de lo vendido en la línea", async () => {
    const venta = await crearVentaPendiente(10, 50);
    await confirmarVenta(ferreteria.id, venta.id, dueno.id);
    const detalle = await prisma.ventaDetalle.findFirstOrThrow({ where: { ventaId: venta.id } });
    const antes = await stockDelProducto();

    await registrarDevolucionVenta(ferreteria.id, detalle.id, 4, "No era lo que buscaba", dueno.id);
    expect((await stockDelProducto()) - antes).toBe(4);

    await expect(registrarDevolucionVenta(ferreteria.id, detalle.id, 7, undefined, dueno.id)).rejects.toThrow(CantidadInvalidaError);
  });

  // Regresión aplicada desde el diseño (mismo bug que en Compras, Fase 7):
  // anular una venta CREDITO con una devolución parcial previa no debe
  // acreditar dos veces lo ya devuelto ni reponer stock de más.
  it("anular una venta CREDITO con devolución parcial previa revierte solo el neto, en stock y en cuenta corriente", async () => {
    const venta = await crearVentaPendiente(10, 100, "CREDITO"); // total 1000
    await confirmarVenta(ferreteria.id, venta.id, dueno.id);
    const detalle = await prisma.ventaDetalle.findFirstOrThrow({ where: { ventaId: venta.id } });

    await registrarDevolucionVenta(ferreteria.id, detalle.id, 3, "dañado", dueno.id); // devuelve 300 de valor

    const stockAntesDeAnular = await stockDelProducto();
    await anularVenta(ferreteria.id, venta.id, dueno.id, "motivo");

    // Repone 7 (10 vendidas - 3 ya devueltas), no 10.
    expect((await stockDelProducto()) - stockAntesDeAnular).toBe(7);

    const saldo = await prisma.cuentaCliente.aggregate({ where: { clienteId }, _sum: { debe: true, haber: true } });
    expect(Number(saldo._sum.debe) - Number(saldo._sum.haber)).toBe(0); // ni de más ni de menos
  });

  it("no se puede devolver mercadería de una venta que no está confirmada", async () => {
    const venta = await crearVentaPendiente(2, 50);
    const detalle = await prisma.ventaDetalle.findFirstOrThrow({ where: { ventaId: venta.id } });
    await expect(registrarDevolucionVenta(ferreteria.id, detalle.id, 1, undefined, dueno.id)).rejects.toThrow(EstadoInvalidoError);
  });

  it("crearVentaConfirmada la deja CONFIRMADO de una sola vez, sin paso por Pendiente", async () => {
    const antes = await stockDelProducto();
    const venta = await crearVentaConfirmada(ferreteria.id, dueno.id, {
      clienteId,
      fecha: new Date().toISOString(),
      tipoIva: "EXENTO",
      medioPago: "CONTADO",
      entrega: 0,
      detalle: [{ productoId, cantidad: 5, precio: 100, descuento: 0 }],
    });

    expect(venta.estado).toBe("CONFIRMADO");
    expect(antes - (await stockDelProducto())).toBe(5);
  });

  it("crearVentaConfirmada con cantidad mayor al stock se confirma igual, con stock negativo", async () => {
    const stockActual = await stockDelProducto();
    const cantidad = Math.max(stockActual, 0) + 5;

    const venta = await crearVentaConfirmada(ferreteria.id, dueno.id, {
      clienteId,
      fecha: new Date().toISOString(),
      tipoIva: "EXENTO",
      medioPago: "CONTADO",
      entrega: 0,
      detalle: [{ productoId, cantidad, precio: 100, descuento: 0 }],
    });

    expect(venta.estado).toBe("CONFIRMADO");
    expect(await stockDelProducto()).toBe(stockActual - cantidad);
  });

  it("el descuento de línea es un porcentaje, no un monto en $", async () => {
    // 4 unidades a $100 con 25% de descuento: total $300, no $100.
    const venta = await crearVentaConfirmada(ferreteria.id, dueno.id, {
      clienteId,
      fecha: new Date().toISOString(),
      tipoIva: "EXENTO",
      medioPago: "CONTADO",
      entrega: 0,
      detalle: [{ productoId, cantidad: 4, precio: 100, descuento: 25 }],
    });

    expect(Number(venta.total)).toBe(300);
    const detalle = await prisma.ventaDetalle.findFirstOrThrow({ where: { ventaId: venta.id } });
    expect(Number(detalle.descuento)).toBe(25);
    expect(Number(detalle.total)).toBe(300);
  });
});
