import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";
import { crearFerreteriaConUsuario } from "@/lib/test-fixtures";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";
import { GET } from "./route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

function sesionDe(usuarioId: string, ferreteriaId: string, rol: "DUENO" | "CAJERO" | "DEPOSITO") {
  mockAuth.mockResolvedValue({
    user: { id: usuarioId, ferreteriaId, ferreteriaNombre: "", rol, isSuperAdmin: false, soporte: false, emitidoEn: Date.now() },
  });
}

describe("/api/dashboard — cada rol ve solo lo que la matriz le permite", () => {
  const sufijo = `dash-permisos-${Date.now()}`;
  let ferreteria: { id: string };
  let cajero: { id: string };
  let deposito: { id: string };
  let dueno: { id: string };
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
  });

  afterAll(async () => {
    await prisma.ferreteria.delete({ where: { id: ferreteria.id } });
    await prisma.ferreteria.delete({ where: { id: ferreteriaSobranteCajero.id } });
    await prisma.ferreteria.delete({ where: { id: ferreteriaSobranteDeposito.id } });
    await prisma.usuario.deleteMany({ where: { id: { in: [dueno.id, cajero.id, deposito.id] } } });
  });

  it("Cajero no recibe cifras de compras (no tiene compras:ver)", async () => {
    sesionDe(cajero.id, ferreteria.id, "CAJERO");
    const data = await GET(new Request("http://test/api/dashboard")).then((r) => r.json());
    expect(data.ventasDelMes).not.toBeNull();
    expect(data.comprasDelMes).toBeNull();
    expect(data.comprasPorProveedor).toBeNull();
  });

  it("Depósito no recibe cifras de ventas (no tiene ventas:ver)", async () => {
    sesionDe(deposito.id, ferreteria.id, "DEPOSITO");
    const data = await GET(new Request("http://test/api/dashboard")).then((r) => r.json());
    expect(data.comprasDelMes).not.toBeNull();
    expect(data.ventasDelMes).toBeNull();
    expect(data.ventasDiarias).toBeNull();
  });

  it("Dueño ve las dos mitades", async () => {
    sesionDe(dueno.id, ferreteria.id, "DUENO");
    const data = await GET(new Request("http://test/api/dashboard")).then((r) => r.json());
    expect(data.ventasDelMes).not.toBeNull();
    expect(data.comprasDelMes).not.toBeNull();
  });

  it("sin sesión, 401", async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET(new Request("http://test/api/dashboard"));
    expect(res.status).toBe(401);
  });
});
