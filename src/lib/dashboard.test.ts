import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { crearFerreteriaConUsuario, borrarFixture } from "@/lib/test-fixtures";
import { totalVentasDelMes, totalComprasDelMes, ventasDiarias, comprasPorProveedor } from "@/lib/dashboard";

describe("dashboard — agregaciones", () => {
  const sufijo = `dash-${Date.now()}`;
  let ferreteria: { id: string };
  let otraFerreteria: { id: string };
  let dueno: { id: string };
  let clienteId: string;
  let proveedorAId: string;
  let proveedorBId: string;

  const ahora = new Date();
  const esteMes = (dia: number) => new Date(ahora.getFullYear(), ahora.getMonth(), dia);
  const mesPasado = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 15);

  beforeAll(async () => {
    ({ ferreteria, usuario: dueno } = await crearFerreteriaConUsuario(sufijo, "DUENO"));
    otraFerreteria = (await prisma.ferreteria.create({ data: { nombre: `Otra ${sufijo}` } }));

    // Solo hacen falta cabeceras de Venta/Compra (las agregaciones del
    // dashboard leen fecha/estado/total, no las líneas) — sin Producto ni
    // catálogo, a diferencia de los tests de compras.ts/ventas.ts.
    clienteId = (await prisma.cliente.create({ data: { ferreteriaId: ferreteria.id, nombre: "Cliente Dash" } })).id;
    proveedorAId = (await prisma.proveedor.create({ data: { ferreteriaId: ferreteria.id, nombre: "Proveedor A" } })).id;
    proveedorBId = (await prisma.proveedor.create({ data: { ferreteriaId: ferreteria.id, nombre: "Proveedor B" } })).id;

    // Ventas: dos confirmadas este mes (en días distintos), una pendiente
    // este mes, una anulada este mes, y una confirmada el mes pasado.
    await prisma.venta.createMany({
      data: [
        { ferreteriaId: ferreteria.id, clienteId, fecha: esteMes(2), estado: "CONFIRMADO", subtotalUYU: 100, ivaUYU: 0, totalUYU: 100 },
        { ferreteriaId: ferreteria.id, clienteId, fecha: esteMes(2), estado: "CONFIRMADO", subtotalUYU: 50, ivaUYU: 0, totalUYU: 50 },
        { ferreteriaId: ferreteria.id, clienteId, fecha: esteMes(3), estado: "CONFIRMADO", subtotalUYU: 200, ivaUYU: 0, totalUYU: 200 },
        { ferreteriaId: ferreteria.id, clienteId, fecha: esteMes(4), estado: "PENDIENTE", subtotalUYU: 999, ivaUYU: 0, totalUYU: 999 },
        { ferreteriaId: ferreteria.id, clienteId, fecha: esteMes(4), estado: "ANULADO", subtotalUYU: 999, ivaUYU: 0, totalUYU: 999 },
        { ferreteriaId: ferreteria.id, clienteId, fecha: mesPasado, estado: "CONFIRMADO", subtotalUYU: 500, ivaUYU: 0, totalUYU: 500 },
      ],
    });

    // Compras: confirmadas este mes repartidas entre dos proveedores, más
    // una pendiente que no debe contarse.
    await prisma.compra.createMany({
      data: [
        { ferreteriaId: ferreteria.id, proveedorId: proveedorAId, fecha: esteMes(5), estado: "CONFIRMADO", subtotalUYU: 300, ivaUYU: 0, totalUYU: 300 },
        { ferreteriaId: ferreteria.id, proveedorId: proveedorAId, fecha: esteMes(6), estado: "CONFIRMADO", subtotalUYU: 100, ivaUYU: 0, totalUYU: 100 },
        { ferreteriaId: ferreteria.id, proveedorId: proveedorBId, fecha: esteMes(6), estado: "CONFIRMADO", subtotalUYU: 250, ivaUYU: 0, totalUYU: 250 },
        { ferreteriaId: ferreteria.id, proveedorId: proveedorBId, fecha: esteMes(6), estado: "PENDIENTE", subtotalUYU: 999, ivaUYU: 0, totalUYU: 999 },
      ],
    });

    // Misma escena en OTRA ferretería, con números bien distintos, para
    // probar que las agregaciones no se mezclan entre tenants.
    const clienteOtra = await prisma.cliente.create({ data: { ferreteriaId: otraFerreteria.id, nombre: "Cliente Otra" } });
    await prisma.venta.create({
      data: { ferreteriaId: otraFerreteria.id, clienteId: clienteOtra.id, fecha: esteMes(2), estado: "CONFIRMADO", subtotalUYU: 99999, ivaUYU: 0, totalUYU: 99999 },
    });
  });

  afterAll(async () => {
    await prisma.venta.deleteMany({ where: { ferreteriaId: { in: [ferreteria.id, otraFerreteria.id] } } });
    await prisma.compra.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.cliente.deleteMany({ where: { ferreteriaId: { in: [ferreteria.id, otraFerreteria.id] } } });
    await prisma.proveedor.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.producto.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.ferreteria.delete({ where: { id: otraFerreteria.id } });
    await borrarFixture(ferreteria.id, [dueno.id]);
  });

  it("totalVentasDelMes suma solo lo CONFIRMADO de este mes, ni pendientes/anuladas ni de otro mes", async () => {
    // 100 + 50 + 200 = 350 (no 999+999 de pendiente/anulada, no 500 del mes pasado)
    expect(await totalVentasDelMes(ferreteria.id)).toEqual({ uyu: 350, usd: 0 });
  });

  it("totalComprasDelMes suma solo lo CONFIRMADO", async () => {
    // 300 + 100 + 250 = 650 (no los 999 de la pendiente)
    expect(await totalComprasDelMes(ferreteria.id)).toEqual({ uyu: 650, usd: 0 });
  });

  it("las agregaciones no mezclan datos entre ferreterías", async () => {
    expect(await totalVentasDelMes(otraFerreteria.id)).toEqual({ uyu: 99999, usd: 0 });
    expect((await totalVentasDelMes(ferreteria.id)).uyu).not.toBe(99999);
  });

  it("ventasDiarias agrupa por día y devuelve los días ordenados", async () => {
    const puntos = await ventasDiarias(ferreteria.id, esteMes(1), esteMes(10));
    // día 2: 100+50=150, día 3: 200 (el día 4 es PENDIENTE/ANULADO, no aparece)
    expect(puntos.map((p) => p.totalUYU)).toEqual([150, 200]);
    expect(puntos[0].fecha < puntos[1].fecha).toBe(true);
  });

  it("comprasPorProveedor agrupa por proveedor con su nombre, ordenado de mayor a menor", async () => {
    const puntos = await comprasPorProveedor(ferreteria.id, esteMes(1), esteMes(10));
    expect(puntos).toEqual([
      { proveedor: "Proveedor A", totalUYU: 400, totalUSD: 0 }, // 300 + 100
      { proveedor: "Proveedor B", totalUYU: 250, totalUSD: 0 }, // solo la confirmada, no la pendiente
    ]);
  });
});
