import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { crearFerreteriaConUsuario, borrarFixture } from "@/lib/test-fixtures";
import { calcularEsperadoCaja, registrarCierreCaja, actualizarCierreCaja } from "@/lib/caja";
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

  it("registrarCierreCaja suma el fondo inicial al esperado, calcula la diferencia y bloquea un segundo cierre que se solape", async () => {
    const cierre = await registrarCierreCaja(ferreteria.id, dueno.id, hoy, hoy, 100, 1250, "Faltaron $50");
    expect(Number(cierre.totalEsperado)).toBe(1300); // 100 de fondo + 1200 del día
    expect(Number(cierre.diferencia)).toBe(-50);

    await expect(registrarCierreCaja(ferreteria.id, dueno.id, hoy, hoy, 0, 1200, undefined)).rejects.toThrow(EstadoInvalidoError);

    const editado = await actualizarCierreCaja(ferreteria.id, cierre.id, dueno.id, { montoInicial: 0, totalContado: 1200 });
    expect(Number(editado.totalEsperado)).toBe(1200); // sin fondo inicial
    expect(Number(editado.diferencia)).toBe(0);
  });

  it("registrarCierreCaja acepta un rango de varios días y lo bloquea si se solapa con uno ya cerrado", async () => {
    const antier = new Date(hoy.getTime() - 2 * 24 * 60 * 60 * 1000);
    const ayer = new Date(hoy.getTime() - 24 * 60 * 60 * 1000);

    const cierre = await registrarCierreCaja(ferreteria.id, dueno.id, antier, ayer, 0, 0, "Cierre de 2 días atrasado");
    expect(cierre.fecha.getTime()).not.toBe(cierre.fechaHasta.getTime());

    // "ayer" ya quedó cubierto por el cierre de arriba (antier→ayer).
    await expect(registrarCierreCaja(ferreteria.id, dueno.id, ayer, ayer, 0, 0, undefined)).rejects.toThrow(EstadoInvalidoError);
  });
});
