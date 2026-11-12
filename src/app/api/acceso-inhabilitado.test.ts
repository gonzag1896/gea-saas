import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";
import { crearFerreteriaConUsuario, borrarFixture } from "@/lib/test-fixtures";
import { cambiarAccesoFerreteria } from "@/lib/ferreterias";
import { EntidadNoEncontradaError } from "@/lib/errores-dominio";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";
import { GET as GET_CLIENTES } from "./clientes/route";
import { GET as GET_DASHBOARD } from "./dashboard/route";
import { GET as GET_BUSCAR } from "./productos/buscar/route";
import { POST as POST_RAPIDO } from "./productos/rapido/route";
import { PATCH as PATCH_ACCESO } from "./admin/ferreterias/[id]/acceso/route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

function sesion(usuarioId: string, ferreteriaId: string | null, rol: "DUENO" | "CAJERO" | null, extra: Record<string, unknown> = {}) {
  mockAuth.mockResolvedValue({
    user: { id: usuarioId, ferreteriaId, ferreteriaNombre: "", rol, isSuperAdmin: false, soporte: false, emitidoEn: Date.now(), ...extra },
  });
}

const patchAcceso = (id: string, body: unknown) =>
  PATCH_ACCESO(new Request("http://test/x", { method: "PATCH", body: JSON.stringify(body) }), { params: { id } });

describe("acceso inhabilitado por cuota vencida", () => {
  const sufijo = `acceso-${Date.now()}`;
  let ferreteria: { id: string };
  let dueno: { id: string };
  let cajero: { id: string };
  let superAdmin: { id: string };

  beforeAll(async () => {
    ({ ferreteria, usuario: dueno } = await crearFerreteriaConUsuario(sufijo, "DUENO"));
    cajero = await prisma.usuario.create({ data: { email: `${sufijo}-cajero@test.gea`, estado: "ACTIVO" } });
    await prisma.ferreteriaUsuario.create({ data: { ferreteriaId: ferreteria.id, usuarioId: cajero.id, rol: "CAJERO" } });
    superAdmin = await prisma.usuario.create({ data: { email: `${sufijo}-super@test.gea`, estado: "ACTIVO", isSuperAdmin: true } });
  });

  afterAll(async () => {
    await prisma.auditLog.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.ferreteriaUsuario.deleteMany({ where: { usuarioId: cajero.id } });
    await prisma.usuario.deleteMany({ where: { id: { in: [cajero.id, superAdmin.id] } } });
    await borrarFixture(ferreteria.id, [dueno.id]);
  });

  const estadoDe = async () => (await prisma.ferreteria.findUniqueOrThrow({ where: { id: ferreteria.id } })).estado;

  it("con el acceso habilitado todo funciona (línea de base)", async () => {
    sesion(dueno.id, ferreteria.id, "DUENO");
    expect((await GET_CLIENTES()).status).toBe(200);
    expect((await GET_DASHBOARD(new Request("http://test/api/dashboard"))).status).toBe(200);
  });

  it("el administrador inhabilita: queda INACTIVO, deja registro y es idempotente", async () => {
    sesion(superAdmin.id, null, null, { isSuperAdmin: true });
    const res = await patchAcceso(ferreteria.id, { habilitado: false });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, estado: "INACTIVO", cambio: true });
    expect(await estadoDe()).toBe("INACTIVO");

    const evento = await prisma.auditLog.findFirst({ where: { accion: "FERRETERIA_ACCESO_INHABILITA", ferreteriaId: ferreteria.id } });
    expect(evento?.usuarioId).toBe(superAdmin.id);

    // repetir no cambia nada ni duplica el registro
    const otra = await patchAcceso(ferreteria.id, { habilitado: false });
    expect(await otra.json()).toMatchObject({ estado: "INACTIVO", cambio: false });
    expect(await prisma.auditLog.count({ where: { accion: "FERRETERIA_ACCESO_INHABILITA", ferreteriaId: ferreteria.id } })).toBe(1);
  });

  it("con el acceso inhabilitado ningún rol puede usar las APIs, ni siquiera leer", async () => {
    for (const [id, rol] of [[dueno.id, "DUENO"], [cajero.id, "CAJERO"]] as const) {
      sesion(id, ferreteria.id, rol);
      expect((await GET_CLIENTES()).status).toBe(403); // requirePermiso: lectura
      expect((await GET_DASHBOARD(new Request("http://test/api/dashboard"))).status).toBe(403);
      expect((await GET_BUSCAR(new Request("http://test/api/productos/buscar?q=a"))).status).toBe(403);
      expect((await POST_RAPIDO(new Request("http://test/x", { method: "POST", body: JSON.stringify({ descripcion: "x" }) }))).status).toBe(403);
    }
  });

  it("el Super Admin sí puede entrar a verla (modo soporte)", async () => {
    sesion(superAdmin.id, ferreteria.id, "DUENO", { isSuperAdmin: true, soporte: true });
    expect((await GET_CLIENTES()).status).toBe(200);
  });

  it("al habilitarla de nuevo, el equipo vuelve a entrar como antes", async () => {
    sesion(superAdmin.id, null, null, { isSuperAdmin: true });
    expect(await (await patchAcceso(ferreteria.id, { habilitado: true })).json()).toMatchObject({ estado: "ACTIVO", cambio: true });
    expect(await estadoDe()).toBe("ACTIVO");
    expect(await prisma.auditLog.count({ where: { accion: "FERRETERIA_ACCESO_HABILITA", ferreteriaId: ferreteria.id } })).toBe(1);

    sesion(cajero.id, ferreteria.id, "CAJERO");
    expect((await GET_CLIENTES()).status).toBe(200);
    sesion(dueno.id, ferreteria.id, "DUENO");
    expect((await GET_DASHBOARD(new Request("http://test/api/dashboard"))).status).toBe(200);
  });

  it("solo el Super Admin puede cambiar el acceso: un Dueño (de esa ferretería) recibe 403 y nada cambia", async () => {
    sesion(dueno.id, ferreteria.id, "DUENO");
    expect((await patchAcceso(ferreteria.id, { habilitado: false })).status).toBe(403);
    expect(await estadoDe()).toBe("ACTIVO");
  });

  it("valida el pedido y la existencia de la ferretería", async () => {
    sesion(superAdmin.id, null, null, { isSuperAdmin: true });
    expect((await patchAcceso(ferreteria.id, { habilitado: "no" })).status).toBe(400);
    expect((await patchAcceso("no-existe", { habilitado: false })).status).toBe(404);
    await expect(cambiarAccesoFerreteria("no-existe", false, superAdmin.id)).rejects.toThrow(EntidadNoEncontradaError);
  });
});
