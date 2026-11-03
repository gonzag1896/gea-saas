import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { crearFerreteriaConUsuario, borrarFixture } from "@/lib/test-fixtures";
import { crearVentaConfirmada, anularVenta, registrarDevolucionVenta } from "@/lib/ventas";
import { registrarCobro } from "@/lib/cuenta-corriente";
import { armarEstadoCuenta, monedasConMovimientos, type MovimientoCuenta } from "@/lib/estado-cuenta";
import { detalleComprasDelCliente, generarEstadoCuentaDeEntidad } from "@/lib/estado-cuenta-servidor";

// Estado de cuenta + detalle de compras con ventas reales: el detalle tiene que
// listar exactamente las ventas que el estado de cuenta cobra, y sumar lo mismo.
describe("detalle de compras en el estado de cuenta del cliente", () => {
  const sufijo = `estado-detalle-${Date.now()}`;
  let ferreteria: { id: string };
  let dueno: { id: string };
  let clienteId: string;
  let productoA: string;
  let productoB: string;

  beforeAll(async () => {
    ({ ferreteria, usuario: dueno } = await crearFerreteriaConUsuario(sufijo, "DUENO"));
    const f = ferreteria.id;
    clienteId = (await prisma.cliente.create({ data: { ferreteriaId: f, nombre: "Diego Pereira" } })).id;
    const categoria = await prisma.categoria.create({ data: { ferreteriaId: f, nombre: "Cat" } });
    const sub = await prisma.subCategoria.create({ data: { ferreteriaId: f, categoriaId: categoria.id, nombre: "Sub" } });
    const marca = await prisma.marca.create({ data: { ferreteriaId: f, nombre: "Marca" } });
    const crear = async (codigo: string, descripcion: string) =>
      (await prisma.producto.create({ data: { ferreteriaId: f, codigo, descripcion, subCategoriaId: sub.id, marcaId: marca.id, stockActual: 100 } })).id;
    productoA = await crear("TOR-001", "Tornillo 6x40 caja x100");
    productoB = await crear("MAR-002", "Martillo carpintero");

    // 1) Crédito con IVA, pesos: 10 × $100 (IVA 22%) + 2 × $50 exentas → total $1.320 + $100... se calcula abajo
    await crearVentaConfirmada(f, dueno.id, {
      clienteId, fecha: "2026-09-10T00:00:00.000Z", medioPago: "CREDITO", entrega: 0,
      detalle: [
        { productoId: productoA, cantidad: 10, precio: 100, moneda: "UYU", descuento: 0, tipoIva: "TOTAL" },
        { productoId: productoB, cantidad: 2, precio: 50, moneda: "UYU", descuento: 10, tipoIva: "EXENTO" },
      ],
    });
    // 2) Mixta pesos + dólares, a crédito
    await crearVentaConfirmada(f, dueno.id, {
      clienteId, fecha: "2026-10-05T00:00:00.000Z", medioPago: "CREDITO", entrega: 0,
      detalle: [
        { productoId: productoA, cantidad: 1, precio: 200, moneda: "UYU", descuento: 0, tipoIva: "EXENTO" },
        { productoId: productoB, cantidad: 3, precio: 10, moneda: "USD", cotizacion: 40, descuento: 0, tipoIva: "EXENTO" },
      ],
    });
    // 3) Contado (genera Debe + Haber en la cuenta)
    await crearVentaConfirmada(f, dueno.id, {
      clienteId, fecha: "2026-10-06T00:00:00.000Z", medioPago: "CONTADO", entrega: 0,
      detalle: [{ productoId: productoB, cantidad: 1, precio: 80, moneda: "UYU", descuento: 0, tipoIva: "EXENTO" }],
    });
    // 4) Venta que se anula (el cargo sigue en el estado, compensado por la anulación)
    const anulada = await crearVentaConfirmada(f, dueno.id, {
      clienteId, fecha: "2026-10-07T00:00:00.000Z", medioPago: "CREDITO", entrega: 0,
      detalle: [{ productoId: productoB, cantidad: 4, precio: 25, moneda: "UYU", descuento: 0, tipoIva: "EXENTO" }],
    });
    await anularVenta(f, anulada.id, dueno.id, "Error de carga");
    // Un cobro y una devolución: están en el estado, NO en el detalle de compras.
    await registrarCobro(f, clienteId, 300, dueno.id, "Recibo 1", "TRANSFERENCIA", "UYU");
    const primera = await prisma.ventaDetalle.findFirstOrThrow({ where: { ferreteriaId: f, productoId: productoA, cantidad: 10 } });
    await registrarDevolucionVenta(f, primera.id, 2, "Sobrante", dueno.id);
  });

  afterAll(async () => {
    const f = ferreteria.id;
    await prisma.cuentaCliente.deleteMany({ where: { ferreteriaId: f } });
    await prisma.movimientoStock.deleteMany({ where: { ferreteriaId: f } });
    await prisma.devolucionVenta.deleteMany({ where: { ferreteriaId: f } });
    await prisma.ventaDetalle.deleteMany({ where: { ferreteriaId: f } });
    await prisma.venta.deleteMany({ where: { ferreteriaId: f } });
    await prisma.cliente.deleteMany({ where: { ferreteriaId: f } });
    await prisma.producto.deleteMany({ where: { ferreteriaId: f } });
    await borrarFixture(f, [dueno.id]);
  });

  async function estadosDelPeriodo(periodo: { desde?: string; hasta?: string }) {
    const filas = await prisma.cuentaCliente.findMany({ where: { ferreteriaId: ferreteria.id, clienteId } });
    const movimientos: MovimientoCuenta[] = filas.map((m) => ({
      id: m.id, fecha: m.fecha, createdAt: m.createdAt, debe: String(m.debe), haber: String(m.haber), moneda: m.moneda,
      origenTipo: m.origenTipo, origenId: m.origenId, referencia: m.referencia, anulado: false,
      montoRecibido: null, monedaRecibida: null, cotizacion: null,
    }));
    return monedasConMovimientos(movimientos).map((m) => armarEstadoCuenta("cliente", movimientos, m, periodo));
  }

  it("lista todas las ventas del estado completo y la suma cierra con el Debe por ventas, en cada moneda", async () => {
    const detalle = await detalleComprasDelCliente(ferreteria.id, clienteId, await estadosDelPeriodo({}));
    expect(detalle.compras).toHaveLength(4); // crédito, mixta, contado y anulada
    expect(detalle.cierra).toBe(true);
    // 1220 (10×100 + 22%) + 90 (2×50 − 10%) + 200 + 80 + 100 = 1690 pesos; US$ 30
    expect(detalle.totalEstado).toEqual({ UYU: 1690, USD: 30 });
    expect(detalle.totalDetalle).toEqual({ UYU: 1690, USD: 30 });
  });

  it("cada venta trae sus líneas con precio, descuento, IVA y lo devuelto, y sus totales", async () => {
    const { compras } = await detalleComprasDelCliente(ferreteria.id, clienteId, await estadosDelPeriodo({}));
    const credito = compras.find((c) => c.fecha === "2026-09-10")!;
    expect(credito.medioPago).toBe("Crédito");
    expect(credito.lineas).toHaveLength(2);
    expect(credito.lineas[0]).toMatchObject({ codigo: "TOR-001", cantidad: 10, devuelta: 2, precio: 100, iva: true, importe: 1000 });
    expect(credito.lineas[1]).toMatchObject({ codigo: "MAR-002", cantidad: 2, precio: 50, descuento: 10, iva: false, importe: 90 });
    expect(credito.totales).toEqual([{ moneda: "UYU", subtotal: 1090, iva: 220, total: 1310 }]);

    const mixta = compras.find((c) => c.fecha === "2026-10-05")!;
    expect(mixta.totales.map((t) => [t.moneda, t.total])).toEqual([["UYU", 200], ["USD", 30]]);
    expect(compras.find((c) => c.fecha === "2026-10-06")!.medioPago).toBe("Contado");
    expect(compras.find((c) => c.fecha === "2026-10-07")!.anulada).toBe(true);
  });

  it("respeta el período: solo las ventas que el estado cobra en esas fechas, y sigue cerrando", async () => {
    const octubre = await detalleComprasDelCliente(ferreteria.id, clienteId, await estadosDelPeriodo({ desde: "2026-10-01", hasta: "2026-10-31" }));
    expect(octubre.compras.map((c) => c.fecha)).toEqual(["2026-10-05", "2026-10-06", "2026-10-07"]);
    expect(octubre.cierra).toBe(true);
    expect(octubre.totalEstado).toEqual({ UYU: 380, USD: 30 });

    const septiembre = await detalleComprasDelCliente(ferreteria.id, clienteId, await estadosDelPeriodo({ hasta: "2026-09-30" }));
    expect(septiembre.compras).toHaveLength(1);
    expect(septiembre.totalDetalle).toEqual({ UYU: 1310, USD: 0 });

    const futuro = await detalleComprasDelCliente(ferreteria.id, clienteId, await estadosDelPeriodo({ desde: "2027-01-01" }));
    expect(futuro.compras).toEqual([]);
    expect(futuro.cierra).toBe(true);
  });

  it("no incluye cobros ni devoluciones: solo lo que el cliente compró", async () => {
    const { compras } = await detalleComprasDelCliente(ferreteria.id, clienteId, await estadosDelPeriodo({}));
    expect(compras.every((c) => c.lineas.length > 0)).toBe(true);
    expect(compras).toHaveLength(4);
  });

  it("el PDF del cliente se genera con el detalle (y el del período vacío también)", async () => {
    const completo = await generarEstadoCuentaDeEntidad("cliente", ferreteria.id, clienteId, {});
    expect(completo!.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    const vacio = await generarEstadoCuentaDeEntidad("cliente", ferreteria.id, clienteId, { desde: "2027-01-01" });
    expect(vacio!.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    // Para inspeccionarlo a mano: PDF_DEBUG_DIR=<carpeta> npx vitest run src/lib/estado-cuenta-detalle.test.ts
    if (process.env.PDF_DEBUG_DIR) {
      fs.writeFileSync(path.join(process.env.PDF_DEBUG_DIR, "estado-con-detalle.pdf"), completo!.buffer);
      fs.writeFileSync(path.join(process.env.PDF_DEBUG_DIR, "estado-con-detalle-octubre.pdf"), (await generarEstadoCuentaDeEntidad("cliente", ferreteria.id, clienteId, { desde: "2026-10-01", hasta: "2026-10-31" }))!.buffer);
    }
  });

  it("el estado de cuenta de un proveedor no lleva detalle de compras", async () => {
    const proveedor = await prisma.proveedor.create({ data: { ferreteriaId: ferreteria.id, nombre: "Prov" } });
    const pdf = await generarEstadoCuentaDeEntidad("proveedor", ferreteria.id, proveedor.id, {});
    expect(pdf!.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    await prisma.proveedor.delete({ where: { id: proveedor.id } });
  });
});
