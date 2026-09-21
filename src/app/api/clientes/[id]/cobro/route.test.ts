import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";
import { crearFerreteriaConUsuario } from "@/lib/test-fixtures";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";
import { POST as cobrar } from "./route";
import { GET as verCuentaCorriente } from "../cuenta-corriente/route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

function sesionDe(usuarioId: string, ferreteriaId: string, rol: "DUENO" | "CAJERO" | "DEPOSITO") {
  mockAuth.mockResolvedValue({
    user: { id: usuarioId, ferreteriaId, ferreteriaNombre: "", rol, isSuperAdmin: false, soporte: false, emitidoEn: Date.now() },
  });
}

describe("permisos por rol — cobros y cuenta corriente", () => {
  const sufijo = `cc-permisos-${Date.now()}`;
  let ferreteria: { id: string };
  let cajero: { id: string };
  let deposito: { id: string };
  let dueno: { id: string };
  let clienteId: string;
  // crearFerreteriaConUsuario siempre crea una Ferretería nueva de
  // acompañante -- acá solo se necesita el Usuario (se suma como miembro
  // de `ferreteria` abajo), pero esas Ferreterías "sobrantes" hay que
  // capturarlas igual para borrarlas en afterAll o quedan huérfanas para
  // siempre en la base (bug real encontrado: 70 "Fixture ..." acumuladas).
  let ferreteriaSobranteCajero: { id: string };
  let ferreteriaSobranteDeposito: { id: string };

  beforeAll(async () => {
    ({ ferreteria, usuario: dueno } = await crearFerreteriaConUsuario(`${sufijo}-d`, "DUENO"));
    ({ ferreteria: ferreteriaSobranteCajero, usuario: cajero } = await crearFerreteriaConUsuario(`${sufijo}-c`, "CAJERO"));
    ({ ferreteria: ferreteriaSobranteDeposito, usuario: deposito } = await crearFerreteriaConUsuario(`${sufijo}-x`, "DEPOSITO"));
    await prisma.ferreteriaUsuario.create({ data: { ferreteriaId: ferreteria.id, usuarioId: cajero.id, rol: "CAJERO" } });
    await prisma.ferreteriaUsuario.create({ data: { ferreteriaId: ferreteria.id, usuarioId: deposito.id, rol: "DEPOSITO" } });
    clienteId = (await prisma.cliente.create({ data: { ferreteriaId: ferreteria.id, nombre: "Cliente" } })).id;
  });

  afterAll(async () => {
    await prisma.cuentaCliente.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.cliente.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.ferreteria.delete({ where: { id: ferreteria.id } });
    await prisma.ferreteria.delete({ where: { id: ferreteriaSobranteCajero.id } });
    await prisma.ferreteria.delete({ where: { id: ferreteriaSobranteDeposito.id } });
    await prisma.usuario.deleteMany({ where: { id: { in: [dueno.id, cajero.id, deposito.id] } } });
  });

  it("Depósito no tiene ningún acceso a cuenta corriente ni a cobros (matriz: ambos módulos sin acceso)", async () => {
    sesionDe(deposito.id, ferreteria.id, "DEPOSITO");
    const resVer = await verCuentaCorriente(new Request("http://test"), { params: { id: clienteId } });
    expect(resVer.status).toBe(403);

    const resCobro = await cobrar(
      new Request("http://test", { method: "POST", body: JSON.stringify({ monto: 100 }) }),
      { params: { id: clienteId } },
    );
    expect(resCobro.status).toBe(403);
  });

  it("Cajero puede ver la cuenta corriente y registrar un cobro", async () => {
    sesionDe(cajero.id, ferreteria.id, "CAJERO");
    const resVer = await verCuentaCorriente(new Request("http://test"), { params: { id: clienteId } });
    expect(resVer.status).toBe(200);

    const resCobro = await cobrar(
      new Request("http://test", { method: "POST", body: JSON.stringify({ monto: 100 }) }),
      { params: { id: clienteId } },
    );
    expect(resCobro.status).toBe(201);
  });

  it("un monto negativo o cero se rechaza con 400", async () => {
    sesionDe(dueno.id, ferreteria.id, "DUENO");
    const res = await cobrar(
      new Request("http://test", { method: "POST", body: JSON.stringify({ monto: 0 }) }),
      { params: { id: clienteId } },
    );
    expect(res.status).toBe(400);
  });
});
