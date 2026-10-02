import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { crearFerreteriaConUsuario, borrarFixture } from "@/lib/test-fixtures";
import { registrarCobro, anularCobro, calcularSaldoCliente } from "@/lib/cuenta-corriente";
import { registrarPagoProveedor, anularPagoProveedor, calcularSaldoProveedor } from "@/lib/cuenta-proveedor";
import { calcularEsperadoCaja } from "@/lib/caja";
import { EstadoInvalidoError, EntidadNoEncontradaError } from "@/lib/errores-dominio";
import { tienePermiso } from "@/lib/permisos";

describe("anular cobros a clientes y pagos a proveedores", () => {
  const sufijo = `anula-${Date.now()}`;
  let ferreteria: { id: string };
  let dueno: { id: string };
  let clienteId: string;
  let proveedorId: string;

  beforeAll(async () => {
    ({ ferreteria, usuario: dueno } = await crearFerreteriaConUsuario(sufijo, "DUENO"));
    clienteId = (await prisma.cliente.create({ data: { ferreteriaId: ferreteria.id, nombre: "Cliente Anula" } })).id;
    proveedorId = (await prisma.proveedor.create({ data: { ferreteriaId: ferreteria.id, nombre: "Proveedor Anula" } })).id;
    // Deuda previa en las dos monedas para que los saldos tengan sentido.
    await prisma.cuentaCliente.createMany({
      data: [
        { ferreteriaId: ferreteria.id, clienteId, fecha: new Date(), debe: 1000, haber: 0, moneda: "UYU", origenTipo: "VENTA_CREDITO" },
        { ferreteriaId: ferreteria.id, clienteId, fecha: new Date(), debe: 50, haber: 0, moneda: "USD", origenTipo: "VENTA_CREDITO" },
      ],
    });
    await prisma.cuentaProveedor.create({
      data: { ferreteriaId: ferreteria.id, proveedorId, fecha: new Date(), debe: 400, haber: 0, moneda: "UYU", origenTipo: "COMPRA_CREDITO" },
    });
  });

  afterAll(async () => {
    await prisma.cuentaCliente.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.cuentaProveedor.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.cliente.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.proveedor.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await borrarFixture(ferreteria.id, [dueno.id]);
  });

  async function ultimoCobro(moneda: "UYU" | "USD") {
    return prisma.cuentaCliente.findFirstOrThrow({ where: { clienteId, origenTipo: "COBRO", moneda }, orderBy: { createdAt: "desc" } });
  }

  it("anular un cobro devuelve el saldo de esa moneda y no toca la otra; el cobro original queda intacto", async () => {
    await registrarCobro(ferreteria.id, clienteId, 300, dueno.id, undefined, "TRANSFERENCIA", "UYU");
    await registrarCobro(ferreteria.id, clienteId, 20, dueno.id, undefined, "TRANSFERENCIA", "USD");
    expect(await calcularSaldoCliente(ferreteria.id, clienteId)).toEqual({ saldoUYU: 700, saldoUSD: 30 });

    const cobro = await ultimoCobro("UYU");
    await anularCobro(ferreteria.id, cobro.id, dueno.id, "Se cargó mal");

    expect(await calcularSaldoCliente(ferreteria.id, clienteId)).toEqual({ saldoUYU: 1000, saldoUSD: 30 });

    const original = await prisma.cuentaCliente.findUniqueOrThrow({ where: { id: cobro.id } });
    expect(Number(original.haber)).toBe(300); // el libro es append-only
    const contraasiento = await prisma.cuentaCliente.findFirstOrThrow({ where: { origenTipo: "ANULACION_COBRO", origenId: cobro.id } });
    expect(Number(contraasiento.debe)).toBe(300);
    expect(contraasiento.moneda).toBe("UYU");
    expect(contraasiento.referencia).toContain("Se cargó mal");

    const evento = await prisma.auditLog.findFirst({ where: { accion: "COBRO_ANULA", ferreteriaId: ferreteria.id } });
    expect(evento?.detalle).toMatchObject({ cobroId: cobro.id, motivo: "Se cargó mal" });
  });

  it("un cobro no se puede anular dos veces", async () => {
    await registrarCobro(ferreteria.id, clienteId, 10, dueno.id, undefined, "TRANSFERENCIA", "UYU");
    const cobro = await ultimoCobro("UYU");
    await anularCobro(ferreteria.id, cobro.id, dueno.id, "uno");
    await expect(anularCobro(ferreteria.id, cobro.id, dueno.id, "dos")).rejects.toThrow(EstadoInvalidoError);
  });

  it("dos anulaciones simultáneas del mismo cobro: solo una prospera", async () => {
    await registrarCobro(ferreteria.id, clienteId, 15, dueno.id, undefined, "TRANSFERENCIA", "UYU");
    const cobro = await ultimoCobro("UYU");
    const resultados = await Promise.allSettled([
      anularCobro(ferreteria.id, cobro.id, dueno.id, "a"),
      anularCobro(ferreteria.id, cobro.id, dueno.id, "b"),
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await prisma.cuentaCliente.count({ where: { origenTipo: "ANULACION_COBRO", origenId: cobro.id } })).toBe(1);
  });

  it("solo se anulan cobros, y solo de la propia ferretería", async () => {
    const venta = await prisma.cuentaCliente.findFirstOrThrow({ where: { clienteId, origenTipo: "VENTA_CREDITO" } });
    await expect(anularCobro(ferreteria.id, venta.id, dueno.id, "x")).rejects.toThrow(EstadoInvalidoError);
    await expect(anularCobro("otra-ferreteria", venta.id, dueno.id, "x")).rejects.toThrow(EntidadNoEncontradaError);
  });

  it("un cobro en efectivo anulado deja de contar en el esperado de caja", async () => {
    const antes = (await calcularEsperadoCaja(ferreteria.id, new Date())).totalCobrosContadoUYU;
    await registrarCobro(ferreteria.id, clienteId, 200, dueno.id, undefined, "CONTADO", "UYU");
    expect((await calcularEsperadoCaja(ferreteria.id, new Date())).totalCobrosContadoUYU).toBe(antes + 200);

    const cobro = await ultimoCobro("UYU");
    await anularCobro(ferreteria.id, cobro.id, dueno.id, "error");
    expect((await calcularEsperadoCaja(ferreteria.id, new Date())).totalCobrosContadoUYU).toBe(antes);
  });

  it("cobro cruzado: paga deuda en pesos con dólares; Caja cuenta los dólares y la anulación revierte ambos", async () => {
    const antes = await calcularEsperadoCaja(ferreteria.id, new Date());
    const saldoAntes = await calcularSaldoCliente(ferreteria.id, clienteId);

    // US$ 10 a cotización 40 cancelan $ 400 de deuda en pesos.
    await registrarCobro(ferreteria.id, clienteId, 10, dueno.id, undefined, "CONTADO", "UYU", { monedaRecibida: "USD", cotizacion: 40 });
    const cobro = await ultimoCobro("UYU");
    expect(Number(cobro.haber)).toBe(400);
    expect(Number(cobro.montoRecibido)).toBe(10);
    expect(cobro.monedaRecibida).toBe("USD");

    expect(await calcularSaldoCliente(ferreteria.id, clienteId)).toEqual({ saldoUYU: saldoAntes.saldoUYU - 400, saldoUSD: saldoAntes.saldoUSD });
    const durante = await calcularEsperadoCaja(ferreteria.id, new Date());
    expect(durante.totalCobrosContadoUSD).toBe(antes.totalCobrosContadoUSD + 10);
    expect(durante.totalCobrosContadoUYU).toBe(antes.totalCobrosContadoUYU);

    await anularCobro(ferreteria.id, cobro.id, dueno.id, "cruzado mal");
    expect(await calcularSaldoCliente(ferreteria.id, clienteId)).toEqual(saldoAntes);
    expect(await calcularEsperadoCaja(ferreteria.id, new Date())).toMatchObject({
      totalCobrosContadoUSD: antes.totalCobrosContadoUSD,
      totalCobrosContadoUYU: antes.totalCobrosContadoUYU,
    });
  });

  it("cobro cruzado inverso: paga deuda en dólares con pesos; sin cotización falla", async () => {
    // $ 420 a cotización 42 cancelan US$ 10.
    await registrarCobro(ferreteria.id, clienteId, 420, dueno.id, undefined, "TRANSFERENCIA", "USD", { monedaRecibida: "UYU", cotizacion: 42 });
    const cobro = await ultimoCobro("USD");
    expect(Number(cobro.haber)).toBe(10);
    await expect(
      registrarCobro(ferreteria.id, clienteId, 5, dueno.id, undefined, "CONTADO", "UYU", { monedaRecibida: "USD", cotizacion: 0 }),
    ).rejects.toThrow(EstadoInvalidoError);
  });

  it("anular un pago a proveedor devuelve la deuda y no se puede repetir", async () => {
    await registrarPagoProveedor(ferreteria.id, proveedorId, 150, dueno.id, undefined, "CONTADO", "UYU");
    expect((await calcularSaldoProveedor(ferreteria.id, proveedorId)).saldoUYU).toBe(250);

    const pago = await prisma.cuentaProveedor.findFirstOrThrow({ where: { proveedorId, origenTipo: "PAGO" } });
    await anularPagoProveedor(ferreteria.id, pago.id, dueno.id, "Duplicado");
    expect((await calcularSaldoProveedor(ferreteria.id, proveedorId)).saldoUYU).toBe(400);

    await expect(anularPagoProveedor(ferreteria.id, pago.id, dueno.id, "otra vez")).rejects.toThrow(EstadoInvalidoError);
  });

  it("anular es exclusivo de Dueño: el Cajero registra cobros pero no los anula", () => {
    expect(tienePermiso("DUENO", "cobros", "anular")).toBe(true);
    expect(tienePermiso("CAJERO", "cobros", "crear")).toBe(true);
    expect(tienePermiso("CAJERO", "cobros", "anular")).toBe(false);
    expect(tienePermiso("DEPOSITO", "pagosProveedor", "anular")).toBe(false);
  });
});
