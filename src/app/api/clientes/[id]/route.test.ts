import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";
import { crearFerreteriaConUsuario, borrarFixture } from "@/lib/test-fixtures";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";
import { DELETE } from "./route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

function sesionDe(usuarioId: string, ferreteriaId: string, rol: "DUENO" | "CAJERO" | "DEPOSITO", soporte = false) {
  mockAuth.mockResolvedValue({
    user: { id: usuarioId, ferreteriaId, ferreteriaNombre: "", rol, isSuperAdmin: false, soporte, emitidoEn: Date.now() },
  });
}

const borrar = (id: string) => DELETE(new Request(`http://test/api/clientes/${id}`, { method: "DELETE" }), { params: { id } });

describe("DELETE /api/clientes/[id] — eliminar solo si no tiene nada asociado", () => {
  const sufijo = `clientes-del-${Date.now()}`;
  let ferreteria: { id: string };
  let dueno: { id: string };
  let cajero: { id: string };
  let otraFerreteria: { id: string };
  let otroDueno: { id: string };

  beforeAll(async () => {
    ({ ferreteria, usuario: dueno } = await crearFerreteriaConUsuario(sufijo, "DUENO"));
    ({ usuario: cajero } = await (async () => {
      const usuario = await prisma.usuario.create({ data: { email: `${sufijo}-cajero@test.gea`, estado: "ACTIVO" } });
      await prisma.ferreteriaUsuario.create({ data: { ferreteriaId: ferreteria.id, usuarioId: usuario.id, rol: "CAJERO" } });
      return { usuario };
    })());
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

  const crearCliente = (nombre: string, ferreteriaId = ferreteria.id) => prisma.cliente.create({ data: { ferreteriaId, nombre, rut: `${Math.random()}`.slice(2, 14) } });
  const existe = async (id: string) => (await prisma.cliente.count({ where: { id } })) === 1;

  it("elimina un cliente sin ventas ni movimientos y deja registro en auditoría", async () => {
    const cliente = await crearCliente("Cliente de prueba");
    sesionDe(dueno.id, ferreteria.id, "DUENO");

    const res = await borrar(cliente.id);
    expect(res.status).toBe(200);
    expect(await existe(cliente.id)).toBe(false);

    const evento = await prisma.auditLog.findFirst({ where: { accion: "CLIENTE_ELIMINA", entidadId: cliente.id } });
    expect(evento?.detalle).toMatchObject({ nombre: "Cliente de prueba" });
    expect(evento?.ferreteriaId).toBe(ferreteria.id);
  });

  it("no elimina un cliente con ventas, ni siquiera anuladas, y explica por qué", async () => {
    const cliente = await crearCliente("Con venta");
    await prisma.venta.create({
      data: { ferreteriaId: ferreteria.id, clienteId: cliente.id, fecha: new Date(), medioPago: "CONTADO", estado: "ANULADO", subtotalUYU: 100, ivaUYU: 0, totalUYU: 100 },
    });
    sesionDe(dueno.id, ferreteria.id, "DUENO");

    const res = await borrar(cliente.id);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/1 venta\b.*Desactivalo/);
    expect(await existe(cliente.id)).toBe(true);
  });

  it("no elimina un cliente con movimientos de cuenta corriente", async () => {
    const cliente = await crearCliente("Con cuenta");
    await prisma.cuentaCliente.createMany({
      data: [
        { ferreteriaId: ferreteria.id, clienteId: cliente.id, fecha: new Date(), debe: 100, haber: 0, moneda: "UYU", origenTipo: "VENTA_CREDITO" },
        { ferreteriaId: ferreteria.id, clienteId: cliente.id, fecha: new Date(), debe: 0, haber: 100, moneda: "UYU", origenTipo: "COBRO" },
      ],
    });
    sesionDe(dueno.id, ferreteria.id, "DUENO");

    const res = await borrar(cliente.id);
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain("2 movimientos de cuenta corriente");
    expect(await existe(cliente.id)).toBe(true);
  });

  it("solo el Dueño puede eliminar: el Cajero recibe 403 y el cliente sigue", async () => {
    const cliente = await crearCliente("Protegido");
    sesionDe(cajero.id, ferreteria.id, "CAJERO");
    const res = await borrar(cliente.id);
    expect(res.status).toBe(403);
    expect(await existe(cliente.id)).toBe(true);
  });

  it("el modo soporte (solo lectura) no puede eliminar", async () => {
    const cliente = await crearCliente("Soporte no borra");
    sesionDe(dueno.id, ferreteria.id, "DUENO", true);
    const res = await borrar(cliente.id);
    expect(res.status).toBe(403);
    expect(await existe(cliente.id)).toBe(true);
  });

  it("no toca clientes de otra ferretería", async () => {
    const ajeno = await crearCliente("Ajeno", otraFerreteria.id);
    sesionDe(dueno.id, ferreteria.id, "DUENO");
    const res = await borrar(ajeno.id);
    expect(res.status).toBe(404);
    expect(await existe(ajeno.id)).toBe(true);
  });

  it("un cliente inexistente da 404", async () => {
    sesionDe(dueno.id, ferreteria.id, "DUENO");
    expect((await borrar("no-existe")).status).toBe(404);
  });
});
