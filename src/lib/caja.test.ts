import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { crearFerreteriaConUsuario, borrarFixture } from "@/lib/test-fixtures";
import { calcularEsperadoCaja, registrarCierreCaja } from "@/lib/caja";
import { registrarCobro } from "@/lib/cuenta-corriente";
import { EstadoInvalidoError } from "@/lib/errores-dominio";

describe("caja — esperado y cierre diario", () => {
  const sufijo = `caja-${Date.now()}`;
  let ferreteria: { id: string };
  let dueno: { id: string };
  let clienteId: string;
  let productoId: string;
  const hoy = new Date();

  beforeAll(async () => {
    ({ ferreteria, usuario: dueno } = await crearFerreteriaConUsuario(sufijo, "DUENO"));
    clienteId = (await prisma.cliente.create({ data: { ferreteriaId: ferreteria.id, nombre: "Cliente Caja" } })).id;
    const categoria = await prisma.categoria.create({ data: { ferreteriaId: ferreteria.id, nombre: "Cat" } });
    const subCategoria = await prisma.subCategoria.create({ data: { ferreteriaId: ferreteria.id, categoriaId: categoria.id, nombre: "Sub" } });
    const marca = await prisma.marca.create({ data: { ferreteriaId: ferreteria.id, nombre: "Marca" } });
    productoId = (await prisma.producto.create({
      data: { ferreteriaId: ferreteria.id, codigo: "P-CAJA", descripcion: "Producto", subCategoriaId: subCategoria.id, marcaId: marca.id, stockActual: 100 },
    })).id;
  });

  afterAll(async () => {
    await prisma.cierreCaja.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.cuentaCliente.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.movimientoStock.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.ventaDetalle.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.venta.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.cliente.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.producto.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await borrarFixture(ferreteria.id, [dueno.id]);
  });

  async function ventaConfirmada(medioPago: "CONTADO" | "CREDITO" | "TRANSFERENCIA", total: number) {
    await prisma.venta.create({
      data: {
        ferreteriaId: ferreteria.id, clienteId, fecha: hoy, medioPago, estado: "CONFIRMADO",
        subtotal: total, iva: 0, total,
        detalle: { create: [{ productoId, cantidad: 1, precio: total, total, totalVigente: total }] },
      },
    });
  }

  it("calcularEsperadoCaja solo suma ventas Contado y cobros Contado — ignora Crédito y Transferencia", async () => {
    await ventaConfirmada("CONTADO", 1000);
    await ventaConfirmada("CREDITO", 5000);
    await ventaConfirmada("TRANSFERENCIA", 3000);
    await registrarCobro(ferreteria.id, clienteId, 200, dueno.id, undefined, "CONTADO");
    await registrarCobro(ferreteria.id, clienteId, 900, dueno.id, undefined, "TRANSFERENCIA");

    const esperado = await calcularEsperadoCaja(ferreteria.id, hoy);
    expect(esperado.totalVentasContado).toBe(1000);
    expect(esperado.totalCobrosContado).toBe(200);
    expect(esperado.totalEsperado).toBe(1200);
  });

  it("registrarCierreCaja calcula la diferencia y bloquea un segundo cierre el mismo día", async () => {
    const cierre = await registrarCierreCaja(ferreteria.id, dueno.id, hoy, 1150, "Faltaron $50");
    expect(Number(cierre.totalEsperado)).toBe(1200);
    expect(Number(cierre.diferencia)).toBe(-50);

    await expect(registrarCierreCaja(ferreteria.id, dueno.id, hoy, 1200, undefined)).rejects.toThrow(EstadoInvalidoError);
  });
});
