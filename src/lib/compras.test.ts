import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { crearFerreteriaConUsuario, borrarFixture } from "@/lib/test-fixtures";
import { confirmarCompra, anularCompra, registrarDevolucionCompra, crearCompraConfirmada } from "@/lib/compras";
import { EstadoInvalidoError, CantidadInvalidaError } from "@/lib/errores-dominio";
import { StockInsuficienteError } from "@/lib/stock";

describe("compras — confirmar, anular, devolución", () => {
  const sufijo = `compras-${Date.now()}`;
  let ferreteria: { id: string };
  let dueno: { id: string };
  let proveedorId: string;
  let productoId: string;

  beforeAll(async () => {
    ({ ferreteria, usuario: dueno } = await crearFerreteriaConUsuario(sufijo, "DUENO"));
    proveedorId = (await prisma.proveedor.create({ data: { ferreteriaId: ferreteria.id, nombre: "Proveedor Test" } })).id;
    const categoria = await prisma.categoria.create({ data: { ferreteriaId: ferreteria.id, nombre: "Cat" } });
    const subCategoria = await prisma.subCategoria.create({ data: { ferreteriaId: ferreteria.id, categoriaId: categoria.id, nombre: "Sub" } });
    const marca = await prisma.marca.create({ data: { ferreteriaId: ferreteria.id, nombre: "Marca" } });
    productoId = (await prisma.producto.create({
      data: { ferreteriaId: ferreteria.id, codigo: "P-COMPRA", descripcion: "Producto de prueba", subCategoriaId: subCategoria.id, marcaId: marca.id },
    })).id;
  });

  afterAll(async () => {
    // Producto->Compra es RESTRICT a propósito (no se pierde historial de
    // compras borrando un producto) — para limpiar la fixture del test hay
    // que bajar en orden de dependencia antes de borrar la ferretería.
    await prisma.cuentaProveedor.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.movimientoStock.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.devolucionCompra.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.compraDetalle.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.compra.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.producto.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await borrarFixture(ferreteria.id, [dueno.id]);
  });

  async function crearCompraPendiente(cantidad: number, costoUnitario: number) {
    return prisma.compra.create({
      data: {
        ferreteriaId: ferreteria.id,
        proveedorId,
        fecha: new Date(),
        subtotalUYU: cantidad * costoUnitario,
        ivaUYU: 0,
        totalUYU: cantidad * costoUnitario,
        // ferreteriaId NO se pasa acá: Prisma lo autocompleta a partir del
        // padre porque es parte de la FK compuesta de la relación "compra"
        // (ver comentario en la ruta real, api/compras/route.ts).
        detalle: { create: [{ productoId, cantidad, costoUnitario, moneda: "UYU", subtotal: cantidad * costoUnitario }] },
      },
    });
  }

  it("confirmar suma stock, actualiza costo y fecha de última compra", async () => {
    const compra = await crearCompraPendiente(10, 5);
    await confirmarCompra(ferreteria.id, compra.id, dueno.id);

    const producto = await prisma.producto.findUniqueOrThrow({ where: { id: productoId } });
    expect(producto.stockActual).toBe(10);
    expect(producto.precioCosto.toString()).toBe("5");
    expect(producto.fechaUltCompra).not.toBeNull();

    const movimiento = await prisma.movimientoStock.findFirst({ where: { origenTipo: "COMPRA", origenId: compra.id } });
    expect(movimiento).toMatchObject({ tipo: "ENTRADA", cantidad: 10 });
  });

  it("confirmar dos veces la misma compra falla la segunda vez, sin duplicar el stock", async () => {
    const compra = await crearCompraPendiente(4, 5);
    await confirmarCompra(ferreteria.id, compra.id, dueno.id);
    await expect(confirmarCompra(ferreteria.id, compra.id, dueno.id)).rejects.toThrow(EstadoInvalidoError);
  });

  it("confirmaciones simultáneas de la misma compra: una sola aplica el stock", async () => {
    const compra = await crearCompraPendiente(7, 5);
    const antes = (await prisma.producto.findUniqueOrThrow({ where: { id: productoId } })).stockActual;

    const resultados = await Promise.allSettled([
      confirmarCompra(ferreteria.id, compra.id, dueno.id),
      confirmarCompra(ferreteria.id, compra.id, dueno.id),
    ]);
    const exitosas = resultados.filter((r) => r.status === "fulfilled").length;
    const fallidas = resultados.filter((r) => r.status === "rejected").length;
    expect(exitosas).toBe(1);
    expect(fallidas).toBe(1);

    const despues = (await prisma.producto.findUniqueOrThrow({ where: { id: productoId } })).stockActual;
    expect(despues - antes).toBe(7); // no 14 — el guard atómico impidió el doble conteo
  });

  it("anular una compra confirmada revierte exactamente el stock que había sumado", async () => {
    const compra = await crearCompraPendiente(6, 5);
    await confirmarCompra(ferreteria.id, compra.id, dueno.id);
    const conStock = (await prisma.producto.findUniqueOrThrow({ where: { id: productoId } })).stockActual;

    await anularCompra(ferreteria.id, compra.id, dueno.id, "Pedido cargado por error");

    const sinStock = (await prisma.producto.findUniqueOrThrow({ where: { id: productoId } })).stockActual;
    expect(conStock - sinStock).toBe(6);

    const compraFinal = await prisma.compra.findUniqueOrThrow({ where: { id: compra.id } });
    expect(compraFinal.estado).toBe("ANULADO");
    expect(compraFinal.motivoAnulacion).toBe("Pedido cargado por error");
  });

  it("anular una compra Pendiente (nunca confirmada) no toca el stock", async () => {
    const compra = await crearCompraPendiente(3, 5);
    const antes = (await prisma.producto.findUniqueOrThrow({ where: { id: productoId } })).stockActual;
    await anularCompra(ferreteria.id, compra.id, dueno.id, "Ya no se necesita");
    const despues = (await prisma.producto.findUniqueOrThrow({ where: { id: productoId } })).stockActual;
    expect(despues).toBe(antes);
  });

  it("anular dos veces la misma compra falla la segunda vez", async () => {
    const compra = await crearCompraPendiente(2, 5);
    await anularCompra(ferreteria.id, compra.id, dueno.id, "motivo");
    await expect(anularCompra(ferreteria.id, compra.id, dueno.id, "motivo")).rejects.toThrow(EstadoInvalidoError);
  });

  it("anular una compra confirmada NO puede dejar el stock negativo: si ya se vendió, la anulación falla y la compra sigue confirmada", async () => {
    const compra = await crearCompraPendiente(5, 5);
    await confirmarCompra(ferreteria.id, compra.id, dueno.id);

    // Se "vende" casi todo lo que había entrado, dejando menos de lo que la
    // anulación necesitaría revertir.
    await prisma.producto.update({ where: { id: productoId }, data: { stockActual: 2 } });

    await expect(anularCompra(ferreteria.id, compra.id, dueno.id, "motivo")).rejects.toThrow(StockInsuficienteError);

    const compraTrasIntento = await prisma.compra.findUniqueOrThrow({ where: { id: compra.id } });
    expect(compraTrasIntento.estado).toBe("CONFIRMADO"); // la transacción se revirtió entera, no quedó a medias
  });

  // Regresión de un bug real encontrado a mano: anular revertía la cantidad
  // ORIGINAL de la línea sin descontar una devolución parcial previa — con
  // stock suficiente eso hubiera revertido de más (contando dos veces la
  // salida de la devolución); acá directamente fallaba con stock
  // insuficiente porque exigía revertir más de lo que la compra tenía
  // pendiente.
  it("anular una compra con una devolución parcial previa revierte solo lo que sigue en stock por esa compra, no la cantidad original", async () => {
    const compra = await crearCompraPendiente(20, 5);
    await confirmarCompra(ferreteria.id, compra.id, dueno.id);
    const detalle = await prisma.compraDetalle.findFirstOrThrow({ where: { compraId: compra.id } });
    await registrarDevolucionCompra(ferreteria.id, detalle.id, 5, "dañado", dueno.id);

    const conStockNeto = (await prisma.producto.findUniqueOrThrow({ where: { id: productoId } })).stockActual;
    await anularCompra(ferreteria.id, compra.id, dueno.id, "motivo");
    const trasAnular = (await prisma.producto.findUniqueOrThrow({ where: { id: productoId } })).stockActual;

    expect(conStockNeto - trasAnular).toBe(15); // 20 compradas - 5 ya devueltas, no 20
  });

  it("devolución parcial descuenta stock y respeta lo ya devuelto de esa línea", async () => {
    const compra = await crearCompraPendiente(8, 5);
    await confirmarCompra(ferreteria.id, compra.id, dueno.id);
    const detalle = await prisma.compraDetalle.findFirstOrThrow({ where: { compraId: compra.id } });
    const antes = (await prisma.producto.findUniqueOrThrow({ where: { id: productoId } })).stockActual;

    await registrarDevolucionCompra(ferreteria.id, detalle.id, 3, "Mercadería dañada", dueno.id);
    const despues = (await prisma.producto.findUniqueOrThrow({ where: { id: productoId } })).stockActual;
    expect(antes - despues).toBe(3);

    // Ya se devolvieron 3 de 8: devolver 6 más se pasaría del total comprado.
    await expect(registrarDevolucionCompra(ferreteria.id, detalle.id, 6, undefined, dueno.id)).rejects.toThrow(CantidadInvalidaError);
  });

  it("no se puede devolver mercadería de una compra que no está confirmada", async () => {
    const compra = await crearCompraPendiente(4, 5);
    const detalle = await prisma.compraDetalle.findFirstOrThrow({ where: { compraId: compra.id } });
    await expect(registrarDevolucionCompra(ferreteria.id, detalle.id, 1, undefined, dueno.id)).rejects.toThrow(EstadoInvalidoError);
  });

  it("crearCompraConfirmada la deja CONFIRMADA de una sola vez, sin paso por Pendiente", async () => {
    const antes = (await prisma.producto.findUniqueOrThrow({ where: { id: productoId } })).stockActual;
    const compra = await crearCompraConfirmada(ferreteria.id, dueno.id, {
      proveedorId,
      fecha: new Date().toISOString(),
      medioPago: "CONTADO",
      detalle: [{ productoId, cantidad: 6, costoUnitario: 8, moneda: "UYU", descuento: 0, tipoIva: "EXENTO" }],
    });

    expect(compra.estado).toBe("CONFIRMADO");
    const producto = await prisma.producto.findUniqueOrThrow({ where: { id: productoId } });
    expect(producto.stockActual - antes).toBe(6);
    expect(producto.precioCosto.toString()).toBe("8");
  });

  it("el descuento de línea es un porcentaje, no un monto en $, y el IVA se calcula sobre el neto", async () => {
    // 10 unidades a $100 con 10% de descuento: neto $900. Con IVA (22%),
    // total esperado $1098 — no $2200*0.22 sobre el bruto sin descontar.
    const compra = await crearCompraConfirmada(ferreteria.id, dueno.id, {
      proveedorId,
      fecha: new Date().toISOString(),
      medioPago: "CONTADO",
      detalle: [{ productoId, cantidad: 10, costoUnitario: 100, moneda: "UYU", descuento: 10, tipoIva: "TOTAL" }],
    });

    expect(Number(compra.subtotalUYU)).toBe(900);
    expect(Number(compra.ivaUYU)).toBeCloseTo(198, 5);
    expect(Number(compra.totalUYU)).toBeCloseTo(1098, 5);

    const detalle = await prisma.compraDetalle.findFirstOrThrow({ where: { compraId: compra.id } });
    expect(Number(detalle.descuento)).toBe(10);
    expect(Number(detalle.subtotal)).toBe(900);
  });

  // Caso central de esta fase: pesos y dólares nunca se mezclan ni se
  // convierten entre sí, ni al guardar la compra ni al asentarla en
  // cuenta corriente de proveedor.
  it("una compra con líneas en pesos y en dólares suma cada moneda por separado, también en cuenta corriente", async () => {
    const compra = await crearCompraConfirmada(ferreteria.id, dueno.id, {
      proveedorId,
      fecha: new Date().toISOString(),
      medioPago: "CREDITO",
      detalle: [
        { productoId, cantidad: 2, costoUnitario: 50, moneda: "UYU", descuento: 0, tipoIva: "EXENTO" }, // $100
        { productoId, cantidad: 5, costoUnitario: 4, moneda: "USD", cotizacion: 42, descuento: 0, tipoIva: "EXENTO" }, // US$20
      ],
    });

    expect(Number(compra.totalUYU)).toBe(100);
    expect(Number(compra.totalUSD)).toBe(20);

    const lineaUSD = await prisma.compraDetalle.findFirstOrThrow({ where: { compraId: compra.id, moneda: "USD" } });
    expect(Number(lineaUSD.cotizacion)).toBe(42);
    expect(Number(lineaUSD.subtotal)).toBe(20);

    const debeUYU = await prisma.cuentaProveedor.findFirstOrThrow({ where: { origenId: compra.id, moneda: "UYU" } });
    const debeUSD = await prisma.cuentaProveedor.findFirstOrThrow({ where: { origenId: compra.id, moneda: "USD" } });
    expect(Number(debeUYU.debe)).toBe(100);
    expect(Number(debeUSD.debe)).toBe(20);
  });

  it("con IVA: devolver y luego anular una compra a crédito deja la deuda con el proveedor en 0 (acredita el IVA)", async () => {
    const proveedor = await prisma.proveedor.create({ data: { ferreteriaId: ferreteria.id, nombre: "Proveedor IVA" } });
    // 10 u. a $50 + IVA 22% = deuda de $610.
    const compra = await crearCompraConfirmada(ferreteria.id, dueno.id, {
      proveedorId: proveedor.id,
      fecha: new Date().toISOString(),
      medioPago: "CREDITO",
      detalle: [{ productoId, cantidad: 10, costoUnitario: 50, moneda: "UYU", descuento: 0, tipoIva: "TOTAL" }],
    });
    const saldo = async () => {
      const r = await prisma.cuentaProveedor.aggregate({ where: { proveedorId: proveedor.id, moneda: "UYU" }, _sum: { debe: true, haber: true } });
      return Number(r._sum.debe) - Number(r._sum.haber);
    };
    expect(await saldo()).toBeCloseTo(610, 2);

    const linea = await prisma.compraDetalle.findFirstOrThrow({ where: { compraId: compra.id } });
    await registrarDevolucionCompra(ferreteria.id, linea.id, 2, undefined, dueno.id); // 2 × 50 × 1.22 = 122
    expect(await saldo()).toBeCloseTo(488, 2);

    await anularCompra(ferreteria.id, compra.id, dueno.id, "error");
    expect(await saldo()).toBeCloseTo(0, 2);
  });
});
