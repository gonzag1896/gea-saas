import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { crearFerreteriaConUsuario, borrarFixture } from "@/lib/test-fixtures";
import { registrarCobro, anularCobro } from "@/lib/cuenta-corriente";
import { registrarPagoProveedor } from "@/lib/cuenta-proveedor";
import { generarReciboDeMovimiento } from "@/lib/recibo-servidor";

describe("recibo de cobro / comprobante de pago", () => {
  const sufijo = `recibo-${Date.now()}`;
  let ferreteria: { id: string };
  let dueno: { id: string };
  let clienteId: string;
  let proveedorId: string;

  beforeAll(async () => {
    ({ ferreteria, usuario: dueno } = await crearFerreteriaConUsuario(sufijo, "DUENO"));
    await prisma.ferreteria.update({ where: { id: ferreteria.id }, data: { rut: "21 999999 0019", direccion: "Av. Italia 1234", telefono: "099 123 456" } });
    clienteId = (await prisma.cliente.create({ data: { ferreteriaId: ferreteria.id, nombre: "Diego Pereira", rut: "4.123.456-7" } })).id;
    proveedorId = (await prisma.proveedor.create({ data: { ferreteriaId: ferreteria.id, nombre: "Proveedor Ñandú" } })).id;
    const base = { ferreteriaId: ferreteria.id, clienteId, fecha: new Date() };
    await prisma.cuentaCliente.createMany({
      data: [
        { ...base, debe: 6000, haber: 0, moneda: "UYU", origenTipo: "VENTA_CREDITO" },
        { ...base, debe: 50, haber: 0, moneda: "USD", origenTipo: "VENTA_CREDITO" },
      ],
    });
    await prisma.cuentaProveedor.create({
      data: { ferreteriaId: ferreteria.id, proveedorId, fecha: new Date(), debe: 900, haber: 0, moneda: "UYU", origenTipo: "COMPRA_CREDITO" },
    });
  });

  afterAll(async () => {
    await prisma.cuentaCliente.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.cuentaProveedor.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.cliente.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.proveedor.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await borrarFixture(ferreteria.id, [dueno.id]);
  });

  const esPdf = (b: Buffer) => b.subarray(0, 5).toString() === "%PDF-";
  const guardar = (nombre: string, b: Buffer) => {
    // Para inspeccionar a mano: PDF_DEBUG_DIR=<carpeta> npx vitest run src/lib/recibo-servidor.test.ts
    if (process.env.PDF_DEBUG_DIR) fs.writeFileSync(path.join(process.env.PDF_DEBUG_DIR, nombre), b);
  };

  it("registrar un cobro devuelve el id del movimiento", async () => {
    const { id } = await registrarCobro(ferreteria.id, clienteId, 1000, dueno.id, "Recibo manual 7", "TRANSFERENCIA", "UYU");
    const mov = await prisma.cuentaCliente.findUniqueOrThrow({ where: { id } });
    expect(mov.origenTipo).toBe("COBRO");
    expect(Number(mov.haber)).toBe(1000);
  });

  it("genera el recibo de un cobro normal", async () => {
    const { id } = await registrarCobro(ferreteria.id, clienteId, 500, dueno.id, "Pago parcial", "CONTADO", "UYU");
    const recibo = await generarReciboDeMovimiento("cliente", ferreteria.id, id);
    expect(recibo).not.toBeNull();
    expect(esPdf(recibo!.buffer)).toBe(true);
    expect(recibo!.archivo).toMatch(/^recibo-rc-[a-z0-9]{8}\.pdf$/);
    guardar("recibo-cobro.pdf", recibo!.buffer);
  });

  it("genera el recibo de un cobro cruzado (paga en dólares una deuda en pesos)", async () => {
    const { id } = await registrarCobro(ferreteria.id, clienteId, 20, dueno.id, undefined, "CONTADO", "UYU", { monedaRecibida: "USD", cotizacion: 40 });
    const recibo = await generarReciboDeMovimiento("cliente", ferreteria.id, id);
    expect(esPdf(recibo!.buffer)).toBe(true);
    guardar("recibo-cobro-cruzado.pdf", recibo!.buffer);
  });

  it("un cobro anulado igual tiene recibo, marcado como anulado", async () => {
    const { id } = await registrarCobro(ferreteria.id, clienteId, 300, dueno.id, "Duplicado", "CONTADO", "UYU");
    await anularCobro(ferreteria.id, id, dueno.id, "Se cargó dos veces");
    const recibo = await generarReciboDeMovimiento("cliente", ferreteria.id, id);
    expect(esPdf(recibo!.buffer)).toBe(true);
    guardar("recibo-cobro-anulado.pdf", recibo!.buffer);
  });

  it("genera el comprobante de un pago a proveedor", async () => {
    const { id } = await registrarPagoProveedor(ferreteria.id, proveedorId, 400, dueno.id, "Transferencia 88", "TRANSFERENCIA", "UYU");
    const comprobante = await generarReciboDeMovimiento("proveedor", ferreteria.id, id);
    expect(esPdf(comprobante!.buffer)).toBe(true);
    expect(comprobante!.archivo).toMatch(/^comprobante-pago-pg-/);
    guardar("comprobante-pago.pdf", comprobante!.buffer);
  });

  it("no entrega recibos de otra ferretería, de ventas ni de cruzar cliente con proveedor", async () => {
    const { id } = await registrarCobro(ferreteria.id, clienteId, 10, dueno.id);
    expect(await generarReciboDeMovimiento("cliente", "otra-ferreteria", id)).toBeNull();

    const venta = await prisma.cuentaCliente.findFirstOrThrow({ where: { clienteId, origenTipo: "VENTA_CREDITO" } });
    expect(await generarReciboDeMovimiento("cliente", ferreteria.id, venta.id)).toBeNull();

    expect(await generarReciboDeMovimiento("proveedor", ferreteria.id, id)).toBeNull(); // un cobro no es un pago
    expect(await generarReciboDeMovimiento("cliente", ferreteria.id, "no-existe")).toBeNull();
  });
});
