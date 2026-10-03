import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { crearFerreteriaConUsuario, borrarFixture } from "@/lib/test-fixtures";

// Valida scripts/ajustar-iva-no-acreditado.cjs sembrando los saldos tal como
// los dejaba el bug (devoluciones/anulaciones acreditadas SIN IVA), incluido
// el caso real de producción de Gabarro ($22.18 de IVA sin acreditar).
function suite(nombre: string, modo: "node" | "sql") {
describe(nombre, () => {
  const sufijo = `ajuste-iva-${Date.now()}`;
  let ferreteria: { id: string; nombre: string };
  let dueno: { id: string };
  let clienteId: string;
  let proveedorId: string;

  beforeAll(async () => {
    ({ ferreteria, usuario: dueno } = await crearFerreteriaConUsuario(sufijo, "DUENO"));
    const f = ferreteria.id;
    clienteId = (await prisma.cliente.create({ data: { ferreteriaId: f, nombre: "Gabarro" } })).id;
    proveedorId = (await prisma.proveedor.create({ data: { ferreteriaId: f, nombre: "Proveedor IVA" } })).id;
    const categoria = await prisma.categoria.create({ data: { ferreteriaId: f, nombre: "Cat" } });
    const subCategoria = await prisma.subCategoria.create({ data: { ferreteriaId: f, categoriaId: categoria.id, nombre: "Sub" } });
    const marca = await prisma.marca.create({ data: { ferreteriaId: f, nombre: "Marca" } });
    const productoId = (await prisma.producto.create({
      data: { ferreteriaId: f, codigo: "P-AJUSTE", descripcion: "x", subCategoriaId: subCategoria.id, marcaId: marca.id, stockActual: 10 },
    })).id;

    // --- Venta de Gabarro, ANULADA, créditos como los dejaba el bug ---
    const venta = await prisma.venta.create({
      data: {
        ferreteriaId: f, clienteId, fecha: new Date(), medioPago: "CREDITO", estado: "ANULADO",
        subtotalUYU: 100.8, ivaUYU: 22.18, totalUYU: 122.98,
        detalle: {
          create: [
            { productoId, cantidad: 2, cantidadDevuelta: 2, precio: 26.22, moneda: "UYU", tipoIva: "TOTAL", total: 52.44, totalVigente: 0 },
            { productoId, cantidad: 1, precio: 48.36, moneda: "UYU", tipoIva: "TOTAL", total: 48.36, totalVigente: 48.36 },
          ],
        },
      },
      include: { detalle: true },
    });
    const lineaA = venta.detalle.find((d) => d.cantidad === 2)!;
    await prisma.devolucionVenta.createMany({
      data: [1, 2].map(() => ({ ferreteriaId: f, ventaDetalleId: lineaA.id, cantidad: 1 })),
    });
    const baseC = { ferreteriaId: f, clienteId, fecha: new Date(), moneda: "UYU" as const };
    await prisma.cuentaCliente.createMany({
      data: [
        { ...baseC, debe: 122.98, haber: 0, origenTipo: "VENTA_CREDITO", origenId: venta.id },
        { ...baseC, debe: 0, haber: 26.22, origenTipo: "DEVOLUCION_VENTA", origenId: lineaA.id },
        { ...baseC, debe: 0, haber: 26.22, origenTipo: "DEVOLUCION_VENTA", origenId: lineaA.id },
        { ...baseC, debe: 0, haber: 48.36, origenTipo: "ANULACION_VENTA_CREDITO", origenId: venta.id },
      ],
    });

    // --- Compra ANULADA con una devolución previa: 10 u. a $50 + IVA = $610 ---
    const compra = await prisma.compra.create({
      data: {
        ferreteriaId: f, proveedorId, fecha: new Date(), medioPago: "CREDITO", estado: "ANULADO",
        subtotalUYU: 500, ivaUYU: 110, totalUYU: 610,
        detalle: { create: [{ productoId, cantidad: 10, costoUnitario: 50, moneda: "UYU", tipoIva: "TOTAL", subtotal: 500 }] },
      },
      include: { detalle: true },
    });
    const linea = compra.detalle[0];
    await prisma.devolucionCompra.create({ data: { ferreteriaId: f, compraDetalleId: linea.id, cantidad: 2 } });
    const baseP = { ferreteriaId: f, proveedorId, fecha: new Date(), moneda: "UYU" as const };
    await prisma.cuentaProveedor.createMany({
      data: [
        { ...baseP, debe: 610, haber: 0, origenTipo: "COMPRA_CREDITO", origenId: compra.id },
        { ...baseP, debe: 0, haber: 100, origenTipo: "DEVOLUCION_COMPRA", origenId: linea.id }, // 2 × 50, sin IVA
        { ...baseP, debe: 0, haber: 400, origenTipo: "ANULACION_COMPRA_CREDITO", origenId: compra.id }, // 8 × 50, sin IVA
      ],
    });
  });

  afterAll(async () => {
    const f = ferreteria.id;
    await prisma.cuentaCliente.deleteMany({ where: { ferreteriaId: f } });
    await prisma.cuentaProveedor.deleteMany({ where: { ferreteriaId: f } });
    await prisma.devolucionVenta.deleteMany({ where: { ferreteriaId: f } });
    await prisma.devolucionCompra.deleteMany({ where: { ferreteriaId: f } });
    await prisma.ventaDetalle.deleteMany({ where: { ferreteriaId: f } });
    await prisma.compraDetalle.deleteMany({ where: { ferreteriaId: f } });
    await prisma.venta.deleteMany({ where: { ferreteriaId: f } });
    await prisma.compra.deleteMany({ where: { ferreteriaId: f } });
    await prisma.cliente.deleteMany({ where: { ferreteriaId: f } });
    await prisma.proveedor.deleteMany({ where: { ferreteriaId: f } });
    await prisma.producto.deleteMany({ where: { ferreteriaId: f } });
    await borrarFixture(f, [dueno.id]);
  });

  // Devuelve un texto con lo que la simulación detectó ("No hay diferencias"
  // si nada); con --aplicar además escribe los ajustes.
  async function correrScript(...args: string[]): Promise<string> {
    if (modo === "node") {
      return execFileSync(process.execPath, [path.join(process.cwd(), "scripts", "ajustar-iva-no-acreditado.cjs"), `--ferreteria=${ferreteria.id}`, ...args], {
        env: process.env,
        encoding: "utf8",
      });
    }
    // SQL de Neon: PASO 1 = SELECT, PASO 2 = INSERT (dos sentencias separadas por el marcador).
    const sql = fs.readFileSync(path.join(process.cwd(), "scripts", "ajustar-iva-no-acreditado.sql"), "utf8");
    const sinTitulo = (s: string) => s.slice(s.indexOf("\n") + 1); // descarta lo que queda de la línea del marcador
    const [antes2, despues2] = sql.split("-- ===== PASO 2");
    const paso1 = sinTitulo(antes2.split("-- ===== PASO 1")[1]);
    const paso2 = sinTitulo(despues2);
    const filas = (await prisma.$queryRawUnsafe<{ ferreteria: string; tipo: string; nombre: string; a_acreditar: unknown }[]>(paso1)).filter(
      (f) => f.ferreteria === ferreteria.nombre,
    );
    if (args.includes("--aplicar")) await prisma.$queryRawUnsafe(paso2);
    return filas.length === 0 ? "No hay diferencias" : `simulación ${filas.map((f) => `${f.tipo} ${f.nombre} ${String(f.a_acreditar)}`).join(" | ")}`;
  }
  async function saldoCliente() {
    const r = await prisma.cuentaCliente.aggregate({ where: { clienteId }, _sum: { debe: true, haber: true } });
    return Number(r._sum.debe) - Number(r._sum.haber);
  }
  async function saldoProveedor() {
    const r = await prisma.cuentaProveedor.aggregate({ where: { proveedorId }, _sum: { debe: true, haber: true } });
    return Number(r._sum.debe) - Number(r._sum.haber);
  }

  it("el estado sembrado reproduce el error: Gabarro debe $22.18 y el proveedor $110", async () => {
    expect(await saldoCliente()).toBeCloseTo(22.18, 2);
    expect(await saldoProveedor()).toBeCloseTo(110, 2);
  });

  it("la simulación detecta los dos casos y NO escribe nada", async () => {
    const salida = await correrScript();
    expect(salida).toContain("simulación");
    expect(salida).toContain("cliente Gabarro");
    expect(salida).toContain("22.18");
    expect(salida).toContain("proveedor Proveedor IVA");
    expect(salida).toMatch(/110(\.00)?/);
    expect(await saldoCliente()).toBeCloseTo(22.18, 2);
    expect(await saldoProveedor()).toBeCloseTo(110, 2);
  });

  it("--aplicar deja los saldos en 0 y no toca los movimientos originales", async () => {
    const antes = await prisma.cuentaCliente.count({ where: { clienteId } });
    await correrScript("--aplicar");
    expect(await saldoCliente()).toBeCloseTo(0, 2);
    expect(await saldoProveedor()).toBeCloseTo(0, 2);
    expect(await prisma.cuentaCliente.count({ where: { clienteId } })).toBe(antes + 1); // un solo ajuste por venta y moneda
    const ajuste = await prisma.cuentaCliente.findFirstOrThrow({ where: { clienteId, referencia: { startsWith: "Ajuste IVA" } } });
    expect(ajuste.origenTipo).toBe("DEVOLUCION_VENTA");
    expect(Number(ajuste.haber)).toBeCloseTo(22.18, 2); // 5.77 + 5.77 + 10.64
  });

  it("es idempotente: correrlo de nuevo no duplica ajustes", async () => {
    const antes = await prisma.cuentaCliente.count({ where: { clienteId } });
    const salida = await correrScript("--aplicar");
    expect(salida).toContain("No hay diferencias");
    expect(await prisma.cuentaCliente.count({ where: { clienteId } })).toBe(antes);
    expect(await saldoCliente()).toBeCloseTo(0, 2);
  });
});
}

suite("script de Node de ajuste de IVA no acreditado", "node");
suite("SQL de Neon de ajuste de IVA no acreditado", "sql");
