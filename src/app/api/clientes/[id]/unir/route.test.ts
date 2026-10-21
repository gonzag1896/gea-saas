import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";
import { crearFerreteriaConUsuario, borrarFixture } from "@/lib/test-fixtures";
import { calcularSaldoCliente } from "@/lib/cuenta-corriente";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";
import { GET, POST } from "./route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

function sesionDe(usuarioId: string, ferreteriaId: string, rol: "DUENO" | "CAJERO" | "DEPOSITO", soporte = false) {
  mockAuth.mockResolvedValue({
    user: { id: usuarioId, ferreteriaId, ferreteriaNombre: "", rol, isSuperAdmin: false, soporte, emitidoEn: Date.now() },
  });
}

const unir = (origenId: string, destinoId: string) =>
  POST(new Request(`http://test/api/clientes/${origenId}/unir`, { method: "POST", body: JSON.stringify({ destinoId }) }), { params: { id: origenId } });
const vistaPrevia = (origenId: string, destinoId: string) =>
  GET(new Request(`http://test/api/clientes/${origenId}/unir?destinoId=${destinoId}`), { params: { id: origenId } });

describe("/api/clientes/[id]/unir — unir clientes duplicados", () => {
  const sufijo = `clientes-unir-${Date.now()}`;
  let ferreteria: { id: string };
  let dueno: { id: string };
  let cajero: { id: string };
  let otraFerreteria: { id: string };
  let otroDueno: { id: string };

  beforeAll(async () => {
    ({ ferreteria, usuario: dueno } = await crearFerreteriaConUsuario(sufijo, "DUENO"));
    cajero = await prisma.usuario.create({ data: { email: `${sufijo}-cajero@test.gea`, estado: "ACTIVO" } });
    await prisma.ferreteriaUsuario.create({ data: { ferreteriaId: ferreteria.id, usuarioId: cajero.id, rol: "CAJERO" } });
    ({ ferreteria: otraFerreteria, usuario: otroDueno } = await crearFerreteriaConUsuario(`${sufijo}-otra`, "DUENO"));
  });

  afterAll(async () => {
    for (const f of [ferreteria.id, otraFerreteria.id]) {
      await prisma.cuentaCliente.deleteMany({ where: { ferreteriaId: f } });
      await prisma.venta.deleteMany({ where: { ferreteriaId: f } });
      await prisma.cliente.deleteMany({ where: { ferreteriaId: f } });
    }
    await prisma.ferreteriaUsuario.deleteMany({ where: { usuarioId: cajero.id } });
    await prisma.usuario.deleteMany({ where: { id: cajero.id } });
    await borrarFixture(ferreteria.id, [dueno.id]);
    await borrarFixture(otraFerreteria.id, [otroDueno.id]);
  });

  const crearCliente = (nombre: string, extra: Record<string, string> = {}, ferreteriaId = ferreteria.id) =>
    prisma.cliente.create({ data: { ferreteriaId, nombre, ...extra } });
  const existe = async (id: string) => (await prisma.cliente.count({ where: { id } })) === 1;

  // Un duplicado con una venta a crédito y movimientos en pesos y dólares.
  async function duplicadoConHistorial(nombre: string, extra: Record<string, string> = {}) {
    const cliente = await crearCliente(nombre, extra);
    const venta = await prisma.venta.create({
      data: { ferreteriaId: ferreteria.id, clienteId: cliente.id, fecha: new Date(), medioPago: "CREDITO", subtotalUYU: 100, ivaUYU: 0, totalUYU: 100 },
    });
    const base = { ferreteriaId: ferreteria.id, clienteId: cliente.id, fecha: new Date() };
    await prisma.cuentaCliente.createMany({
      data: [
        { ...base, debe: 100, haber: 0, moneda: "UYU", origenTipo: "VENTA_CREDITO", origenId: venta.id },
        { ...base, debe: 0, haber: 30, moneda: "UYU", origenTipo: "COBRO" },
        { ...base, debe: 50, haber: 0, moneda: "USD", origenTipo: "VENTA_CREDITO" },
      ],
    });
    return { cliente, venta };
  }

  it("pasa ventas y movimientos al cliente que se conserva, suma los saldos por moneda y borra el duplicado", async () => {
    const { cliente: duplicado, venta } = await duplicadoConHistorial("Gabarro (duplicado)");
    const conservado = await crearCliente("Gabarro");
    await prisma.cuentaCliente.create({
      data: { ferreteriaId: ferreteria.id, clienteId: conservado.id, fecha: new Date(), debe: 500, haber: 0, moneda: "UYU", origenTipo: "VENTA_CREDITO" },
    });
    sesionDe(dueno.id, ferreteria.id, "DUENO");

    const res = await unir(duplicado.id, conservado.id);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, ventas: 1, movimientos: 3 });

    expect(await existe(duplicado.id)).toBe(false);
    expect((await prisma.venta.findUniqueOrThrow({ where: { id: venta.id } })).clienteId).toBe(conservado.id);
    // 500 + (100 - 30) en pesos; 50 en dólares
    expect(await calcularSaldoCliente(ferreteria.id, conservado.id)).toEqual({ saldoUYU: 570, saldoUSD: 50 });

    const evento = await prisma.auditLog.findFirst({ where: { accion: "CLIENTE_UNE", entidadId: conservado.id } });
    expect(evento?.detalle).toMatchObject({
      duplicadoNombre: "Gabarro (duplicado)",
      ventasMovidas: 1,
      movimientosMovidos: 3,
      saldoDuplicado: { saldoUYU: 70, saldoUSD: 50 },
    });
  });

  it("completa los datos que le faltan al cliente que queda (incluido el RUT) sin pisar los que ya tiene", async () => {
    const duplicado = await crearCliente("Dup datos", { rut: "219999990011", telefono: "099111222", email: "dup@x.uy", ciudad: "Canelones" });
    const conservado = await crearCliente("Cons datos", { email: "oficial@x.uy" });
    sesionDe(dueno.id, ferreteria.id, "DUENO");

    const previa = await (await vistaPrevia(duplicado.id, conservado.id)).json();
    expect(previa.camposACopiar).toEqual(["RUT", "teléfono", "ciudad"]);

    expect((await unir(duplicado.id, conservado.id)).status).toBe(200);
    const final = await prisma.cliente.findUniqueOrThrow({ where: { id: conservado.id } });
    expect(final).toMatchObject({ rut: "219999990011", telefono: "099111222", ciudad: "Canelones", email: "oficial@x.uy" });
  });

  it("la vista previa informa lo que va a pasar y no cambia nada", async () => {
    const { cliente: duplicado } = await duplicadoConHistorial("Dup preview");
    const conservado = await crearCliente("Cons preview");
    sesionDe(dueno.id, ferreteria.id, "DUENO");

    const res = await vistaPrevia(duplicado.id, conservado.id);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      origen: { nombre: "Dup preview", ventas: 1, movimientos: 3, saldoUYU: 70, saldoUSD: 50 },
      destino: { nombre: "Cons preview", saldoUYU: 0, saldoUSD: 0 },
      destinoDespues: { saldoUYU: 70, saldoUSD: 50 },
    });
    expect(await existe(duplicado.id)).toBe(true);
    expect(await prisma.cuentaCliente.count({ where: { clienteId: duplicado.id } })).toBe(3);
  });

  it("no permite unir un cliente consigo mismo", async () => {
    const cliente = await crearCliente("Solo");
    sesionDe(dueno.id, ferreteria.id, "DUENO");
    const res = await unir(cliente.id, cliente.id);
    expect(res.status).toBe(409);
    expect(await existe(cliente.id)).toBe(true);
  });

  it("solo el Dueño puede unir: Cajero y modo soporte reciben 403 y no cambia nada", async () => {
    const { cliente: duplicado } = await duplicadoConHistorial("Dup permisos");
    const conservado = await crearCliente("Cons permisos");

    sesionDe(cajero.id, ferreteria.id, "CAJERO");
    expect((await unir(duplicado.id, conservado.id)).status).toBe(403);
    expect((await vistaPrevia(duplicado.id, conservado.id)).status).toBe(403);

    sesionDe(dueno.id, ferreteria.id, "DUENO", true);
    expect((await unir(duplicado.id, conservado.id)).status).toBe(403);

    expect(await existe(duplicado.id)).toBe(true);
    expect(await prisma.cuentaCliente.count({ where: { clienteId: duplicado.id } })).toBe(3);
  });

  it("no mezcla ferreterías: un cliente de otra ferretería da 404 y nada se mueve", async () => {
    const { cliente: duplicado } = await duplicadoConHistorial("Dup tenant");
    const ajeno = await crearCliente("Ajeno", {}, otraFerreteria.id);
    sesionDe(dueno.id, ferreteria.id, "DUENO");

    expect((await unir(duplicado.id, ajeno.id)).status).toBe(404); // destino de otra ferretería
    expect((await unir(ajeno.id, duplicado.id)).status).toBe(404); // origen de otra ferretería
    expect(await existe(duplicado.id)).toBe(true);
    expect(await existe(ajeno.id)).toBe(true);
    expect(await prisma.cuentaCliente.count({ where: { clienteId: duplicado.id } })).toBe(3);
  });

  it("pide el cliente a conservar", async () => {
    const cliente = await crearCliente("Sin destino");
    sesionDe(dueno.id, ferreteria.id, "DUENO");
    const res = await POST(new Request("http://test/x", { method: "POST", body: JSON.stringify({}) }), { params: { id: cliente.id } });
    expect(res.status).toBe(400);
  });
});
