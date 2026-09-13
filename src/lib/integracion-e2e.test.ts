import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { crearFerreteriaConUsuario, borrarFixture } from "@/lib/test-fixtures";
import { confirmarCompra } from "@/lib/compras";
import { confirmarVenta, anularVenta } from "@/lib/ventas";
import { registrarCobro, calcularSaldoCliente } from "@/lib/cuenta-corriente";
import { totalVentasDelMes, totalComprasDelMes, comprasPorProveedor } from "@/lib/dashboard";

// Fase 13 — el resto de la suite prueba cada módulo por separado; esto
// prueba que, ENCADENADOS, siguen dando el resultado correcto y que dos
// ferreterías corriendo el flujo completo al mismo tiempo (Promise.all, no
// en secuencia) no se pisan en ningún punto de la cadena: stock, cuenta
// corriente ni dashboard. Cantidades y precios deliberadamente distintos
// entre A y B — si algo se filtrara de un tenant a otro, algún assert acá
// abajo daría el número equivocado.
describe("integración end-to-end — compra -> venta -> cobro -> dashboard, 2 ferreterías en paralelo", () => {
  const sufijo = `e2e-${Date.now()}`;

  type Tenant = {
    ferreteria: { id: string };
    dueno: { id: string };
    proveedorId: string;
    clienteId: string;
    productoId: string;
  };

  async function armarTenant(letra: string): Promise<Tenant> {
    const { ferreteria, usuario: dueno } = await crearFerreteriaConUsuario(`${sufijo}-${letra}`, "DUENO");
    const proveedorId = (await prisma.proveedor.create({ data: { ferreteriaId: ferreteria.id, nombre: `Proveedor ${letra}` } })).id;
    const clienteId = (await prisma.cliente.create({ data: { ferreteriaId: ferreteria.id, nombre: `Cliente ${letra}` } })).id;
    const categoria = await prisma.categoria.create({ data: { ferreteriaId: ferreteria.id, nombre: "Cat" } });
    const subCategoria = await prisma.subCategoria.create({ data: { ferreteriaId: ferreteria.id, categoriaId: categoria.id, nombre: "Sub" } });
    const marca = await prisma.marca.create({ data: { ferreteriaId: ferreteria.id, nombre: "Marca" } });
    const productoId = (await prisma.producto.create({
      data: { ferreteriaId: ferreteria.id, codigo: `P-${letra}`, descripcion: `Producto ${letra}`, subCategoriaId: subCategoria.id, marcaId: marca.id },
    })).id;
    return { ferreteria, dueno, proveedorId, clienteId, productoId };
  }

  let a: Tenant;
  let b: Tenant;

  beforeAll(async () => {
    [a, b] = await Promise.all([armarTenant("A"), armarTenant("B")]);
  });

  afterAll(async () => {
    for (const t of [a, b]) {
      await prisma.cuentaCliente.deleteMany({ where: { ferreteriaId: t.ferreteria.id } });
      await prisma.movimientoStock.deleteMany({ where: { ferreteriaId: t.ferreteria.id } });
      await prisma.ventaDetalle.deleteMany({ where: { ferreteriaId: t.ferreteria.id } });
      await prisma.venta.deleteMany({ where: { ferreteriaId: t.ferreteria.id } });
      await prisma.compraDetalle.deleteMany({ where: { ferreteriaId: t.ferreteria.id } });
      await prisma.compra.deleteMany({ where: { ferreteriaId: t.ferreteria.id } });
      await prisma.cliente.deleteMany({ where: { ferreteriaId: t.ferreteria.id } });
      await prisma.proveedor.deleteMany({ where: { ferreteriaId: t.ferreteria.id } });
      await prisma.producto.deleteMany({ where: { ferreteriaId: t.ferreteria.id } });
      await borrarFixture(t.ferreteria.id, [t.dueno.id]);
    }
  });

  // Escenario de A: compra 20 u. a $50 (=1000), vende 12 u. a $100 a
  // crédito (=1200), cobra 500 -> saldo esperado 700, stock esperado 8.
  // Escenario de B: números bien distintos a propósito (compra 50 u. a
  // $10=500, vende 30 u. a $40=1200 crédito, cobra 1200 -> saldo 0, stock
  // 20) para que cualquier mezcla entre tenants se note enseguida.
  async function correrFlujoCompleto(t: Tenant, params: {
    cantidadCompra: number; costoUnitario: number;
    cantidadVenta: number; precioVenta: number;
    cobro: number;
  }) {
    const totalCompra = params.cantidadCompra * params.costoUnitario;
    const compra = await prisma.compra.create({
      data: {
        ferreteriaId: t.ferreteria.id, proveedorId: t.proveedorId, fecha: new Date(),
        subtotal: totalCompra, iva: 0, total: totalCompra,
        detalle: { create: [{ productoId: t.productoId, cantidad: params.cantidadCompra, costoUnitario: params.costoUnitario, subtotal: totalCompra }] },
      },
    });
    await confirmarCompra(t.ferreteria.id, compra.id, t.dueno.id);

    const totalVenta = params.cantidadVenta * params.precioVenta;
    const venta = await prisma.venta.create({
      data: {
        ferreteriaId: t.ferreteria.id, clienteId: t.clienteId, fecha: new Date(), medioPago: "CREDITO",
        subtotal: totalVenta, iva: 0, total: totalVenta,
        detalle: { create: [{ productoId: t.productoId, cantidad: params.cantidadVenta, precio: params.precioVenta, total: totalVenta, totalVigente: totalVenta }] },
      },
    });
    await confirmarVenta(t.ferreteria.id, venta.id, t.dueno.id);

    await registrarCobro(t.ferreteria.id, t.clienteId, params.cobro, t.dueno.id, `Pago parcial ${t.ferreteria.id}`);

    return { compra, venta, totalCompra, totalVenta };
  }

  it("el flujo completo da los números correctos para cada ferretería, corriendo ambas en simultáneo", async () => {
    const [resA, resB] = await Promise.all([
      correrFlujoCompleto(a, { cantidadCompra: 20, costoUnitario: 50, cantidadVenta: 12, precioVenta: 100, cobro: 500 }),
      correrFlujoCompleto(b, { cantidadCompra: 50, costoUnitario: 10, cantidadVenta: 30, precioVenta: 40, cobro: 1200 }),
    ]);

    // --- Stock: cada producto solo vio los movimientos de su propia ferretería ---
    const [productoA, productoB] = await Promise.all([
      prisma.producto.findUniqueOrThrow({ where: { id: a.productoId } }),
      prisma.producto.findUniqueOrThrow({ where: { id: b.productoId } }),
    ]);
    expect(productoA.stockActual).toBe(20 - 12); // 8
    expect(productoB.stockActual).toBe(50 - 30); // 20

    // --- Cuenta corriente: saldo de cada cliente, sin mezclar ---
    const [saldoA, saldoB] = await Promise.all([
      calcularSaldoCliente(a.ferreteria.id, a.clienteId),
      calcularSaldoCliente(b.ferreteria.id, b.clienteId),
    ]);
    expect(saldoA).toBe(resA.totalVenta - 500); // 1200 - 500 = 700
    expect(saldoB).toBe(resB.totalVenta - 1200); // 1200 - 1200 = 0

    // --- Dashboard: totales del mes, aislados por ferreteriaId ---
    const [ventasMesA, comprasMesA, ventasMesB, comprasMesB] = await Promise.all([
      totalVentasDelMes(a.ferreteria.id),
      totalComprasDelMes(a.ferreteria.id),
      totalVentasDelMes(b.ferreteria.id),
      totalComprasDelMes(b.ferreteria.id),
    ]);
    expect(ventasMesA).toBe(resA.totalVenta); // 1200
    expect(comprasMesA).toBe(resA.totalCompra); // 1000
    expect(ventasMesB).toBe(resB.totalVenta); // 1200 (igual a A a propósito: mismo número, ferretería distinta)
    expect(comprasMesB).toBe(resB.totalCompra); // 500

    const inicioMes = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const finMes = new Date();
    const [porProveedorA, porProveedorB] = await Promise.all([
      comprasPorProveedor(a.ferreteria.id, inicioMes, finMes),
      comprasPorProveedor(b.ferreteria.id, inicioMes, finMes),
    ]);
    expect(porProveedorA).toEqual([{ proveedor: "Proveedor A", total: 1000 }]);
    expect(porProveedorB).toEqual([{ proveedor: "Proveedor B", total: 500 }]);
  });

  it("anular la venta de una ferretería en medio del flujo no toca stock ni saldo de la otra", async () => {
    const ventaA = await prisma.venta.findFirstOrThrow({ where: { ferreteriaId: a.ferreteria.id } });
    const [stockBAntes, saldoBAntes] = await Promise.all([
      prisma.producto.findUniqueOrThrow({ where: { id: b.productoId } }).then((p) => p.stockActual),
      calcularSaldoCliente(b.ferreteria.id, b.clienteId),
    ]);

    await anularVenta(a.ferreteria.id, ventaA.id, a.dueno.id, "Prueba de aislamiento");

    const [stockBDespues, saldoBDespues] = await Promise.all([
      prisma.producto.findUniqueOrThrow({ where: { id: b.productoId } }).then((p) => p.stockActual),
      calcularSaldoCliente(b.ferreteria.id, b.clienteId),
    ]);
    expect(stockBDespues).toBe(stockBAntes);
    expect(saldoBDespues).toBe(saldoBAntes);

    // Y en A sí se revirtió: repuso las 12 unidades vendidas.
    const productoA = await prisma.producto.findUniqueOrThrow({ where: { id: a.productoId } });
    expect(productoA.stockActual).toBe(20); // 8 (post-venta) + 12 repuestas
  });
});
