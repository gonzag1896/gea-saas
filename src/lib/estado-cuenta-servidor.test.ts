import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@/lib/db";
import { crearFerreteriaConUsuario, borrarFixture } from "@/lib/test-fixtures";
import { generarEstadoCuentaDeEntidad, periodoDesdeParams } from "@/lib/estado-cuenta-servidor";
import { registrarCobro, anularCobro } from "@/lib/cuenta-corriente";

describe("estado de cuenta en PDF", () => {
  const sufijo = `estado-cuenta-${Date.now()}`;
  let ferreteria: { id: string };
  let dueno: { id: string };
  let clienteId: string;
  let proveedorId: string;

  beforeAll(async () => {
    ({ ferreteria, usuario: dueno } = await crearFerreteriaConUsuario(sufijo, "DUENO"));
    await prisma.ferreteria.update({ where: { id: ferreteria.id }, data: { rut: "21 999999 0019", direccion: "Av. Italia 1234", telefono: "099 123 456" } });
    clienteId = (await prisma.cliente.create({ data: { ferreteriaId: ferreteria.id, nombre: "Diego Pereira", rut: "4.123.456-7" } })).id;
    proveedorId = (await prisma.proveedor.create({ data: { ferreteriaId: ferreteria.id, nombre: "Proveedor Ñandú" } })).id;
    const base = { ferreteriaId: ferreteria.id, clienteId, fecha: new Date("2026-09-10T00:00:00.000Z") };
    await prisma.cuentaCliente.createMany({
      data: [
        { ...base, debe: 1800, haber: 0, moneda: "UYU", origenTipo: "VENTA_CREDITO" },
        { ...base, debe: 4200, haber: 0, moneda: "UYU", origenTipo: "VENTA_CREDITO" },
        { ...base, debe: 50, haber: 0, moneda: "USD", origenTipo: "VENTA_CREDITO" },
      ],
    });
    await registrarCobro(ferreteria.id, clienteId, 500, dueno.id, "Recibo 15", "TRANSFERENCIA", "UYU");
    await registrarCobro(ferreteria.id, clienteId, 10, dueno.id, undefined, "CONTADO", "UYU", { monedaRecibida: "USD", cotizacion: 40 });
    const cobro = await prisma.cuentaCliente.findFirstOrThrow({ where: { clienteId, origenTipo: "COBRO", referencia: "Recibo 15" } });
    await anularCobro(ferreteria.id, cobro.id, dueno.id, "Duplicado");
    await prisma.cuentaProveedor.create({
      data: { ferreteriaId: ferreteria.id, proveedorId, fecha: new Date("2026-09-12T00:00:00.000Z"), debe: 900, haber: 0, moneda: "UYU", origenTipo: "COMPRA_CREDITO" },
    });
  });

  afterAll(async () => {
    await prisma.cuentaCliente.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.cuentaProveedor.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.cliente.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.proveedor.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await borrarFixture(ferreteria.id, [dueno.id]);
  });

  it("genera un PDF válido del cliente, con el historial completo y con período", async () => {
    const completo = await generarEstadoCuentaDeEntidad("cliente", ferreteria.id, clienteId, {});
    expect(completo).not.toBeNull();
    expect(completo!.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(completo!.archivo).toMatch(/^estado-de-cuenta-diego-pereira-\d{4}-\d{2}-\d{2}\.pdf$/);

    const conPeriodo = await generarEstadoCuentaDeEntidad("cliente", ferreteria.id, clienteId, { desde: "2026-09-11", hasta: "2026-12-31" });
    expect(conPeriodo!.buffer.subarray(0, 5).toString()).toBe("%PDF-");

    // Para inspeccionar el resultado a mano: PDF_DEBUG_DIR=<carpeta> npx vitest run src/lib/estado-cuenta-servidor.test.ts
    if (process.env.PDF_DEBUG_DIR) {
      fs.writeFileSync(path.join(process.env.PDF_DEBUG_DIR, "estado-cliente.pdf"), completo!.buffer);
      fs.writeFileSync(path.join(process.env.PDF_DEBUG_DIR, "estado-cliente-periodo.pdf"), conPeriodo!.buffer);
    }
  });

  it("genera el PDF del proveedor", async () => {
    const pdf = await generarEstadoCuentaDeEntidad("proveedor", ferreteria.id, proveedorId, {});
    expect(pdf!.buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf!.archivo).toContain("proveedor-nandu");
    if (process.env.PDF_DEBUG_DIR) fs.writeFileSync(path.join(process.env.PDF_DEBUG_DIR, "estado-proveedor.pdf"), pdf!.buffer);
  });

  it("no entrega el estado de cuenta de otra ferretería", async () => {
    expect(await generarEstadoCuentaDeEntidad("cliente", "otra-ferreteria", clienteId, {})).toBeNull();
    expect(await generarEstadoCuentaDeEntidad("proveedor", "otra-ferreteria", proveedorId, {})).toBeNull();
    expect(await generarEstadoCuentaDeEntidad("cliente", ferreteria.id, "no-existe", {})).toBeNull();
  });

  it("solo acepta fechas AAAA-MM-DD en el período", () => {
    expect(periodoDesdeParams(new URLSearchParams("desde=2026-09-01&hasta=2026-09-30"))).toEqual({ desde: "2026-09-01", hasta: "2026-09-30" });
    expect(periodoDesdeParams(new URLSearchParams("desde=01/09/2026&hasta=x"))).toEqual({ desde: undefined, hasta: undefined });
  });
});
