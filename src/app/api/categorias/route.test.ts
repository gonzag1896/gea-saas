import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";

// Se mockea solo `auth()` (quién está logueado) — todo lo demás (Prisma,
// obtenerContextoTenant, sesionSigueValida) corre de verdad contra el
// Postgres local. Es la forma más honesta de probar el aislamiento: si
// mockeara también la capa de datos, el test no probaría nada del patrón
// real que usa la ruta.
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";
import { GET, POST } from "./route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

function sesionDe(
  usuarioId: string,
  ferreteriaId: string,
  rol: "DUENO" | "CAJERO" | "DEPOSITO",
  opciones: { soporte?: boolean } = {},
) {
  mockAuth.mockResolvedValue({
    user: { id: usuarioId, ferreteriaId, ferreteriaNombre: "", rol, isSuperAdmin: !!opciones.soporte, soporte: !!opciones.soporte, emitidoEn: Date.now() },
  });
}

describe("aislamiento entre tenants — /api/categorias", () => {
  const sufijo = `test-${Date.now()}`;
  let ferreteriaA: { id: string };
  let ferreteriaB: { id: string };
  let usuarioA: { id: string };
  let usuarioB: { id: string };

  beforeAll(async () => {
    ferreteriaA = await prisma.ferreteria.create({ data: { nombre: `Ferretería A ${sufijo}` } });
    ferreteriaB = await prisma.ferreteria.create({ data: { nombre: `Ferretería B ${sufijo}` } });

    usuarioA = await prisma.usuario.create({ data: { email: `a-${sufijo}@test.gea`, estado: "ACTIVO" } });
    usuarioB = await prisma.usuario.create({ data: { email: `b-${sufijo}@test.gea`, estado: "ACTIVO" } });

    await prisma.ferreteriaUsuario.create({ data: { ferreteriaId: ferreteriaA.id, usuarioId: usuarioA.id, rol: "DUENO" } });
    await prisma.ferreteriaUsuario.create({ data: { ferreteriaId: ferreteriaB.id, usuarioId: usuarioB.id, rol: "DUENO" } });
  });

  afterAll(async () => {
    // Cascada desde Ferreteria se lleva Categoria y FerreteriaUsuario;
    // Usuario no cuelga de ninguna ferretería, se borra aparte.
    await prisma.ferreteria.deleteMany({ where: { id: { in: [ferreteriaA.id, ferreteriaB.id] } } });
    await prisma.usuario.deleteMany({ where: { id: { in: [usuarioA.id, usuarioB.id] } } });
  });

  it("A crea una categoría y la ve en su propia lista", async () => {
    sesionDe(usuarioA.id, ferreteriaA.id, "DUENO");

    const resPost = await POST(new Request("http://test/api/categorias", { method: "POST", body: JSON.stringify({ nombre: "Herramientas" }) }));
    expect(resPost.status).toBe(201);

    const resGet = await GET();
    const { categorias } = await resGet.json();
    expect(categorias.map((c: { nombre: string }) => c.nombre)).toEqual(["Herramientas"]);
  });

  it("B no ve la categoría de A — su lista está vacía", async () => {
    sesionDe(usuarioB.id, ferreteriaB.id, "DUENO");

    const resGet = await GET();
    const { categorias } = await resGet.json();
    expect(categorias).toEqual([]);
  });

  it("sin sesión, la ruta rechaza con 401 en vez de listar cualquier cosa", async () => {
    mockAuth.mockResolvedValue(null);

    const resGet = await GET();
    expect(resGet.status).toBe(401);
  });
});

describe("permisos por rol — /api/categorias", () => {
  const sufijo = `test-permisos-${Date.now()}`;
  let ferreteria: { id: string };
  let cajero: { id: string };
  let deposito: { id: string };
  let superAdmin: { id: string };

  beforeAll(async () => {
    ferreteria = await prisma.ferreteria.create({ data: { nombre: `Permisos ${sufijo}` } });
    cajero = await prisma.usuario.create({ data: { email: `cajero-${sufijo}@test.gea`, estado: "ACTIVO" } });
    deposito = await prisma.usuario.create({ data: { email: `deposito-${sufijo}@test.gea`, estado: "ACTIVO" } });
    superAdmin = await prisma.usuario.create({ data: { email: `super-${sufijo}@test.gea`, estado: "ACTIVO", isSuperAdmin: true } });
    await prisma.ferreteriaUsuario.create({ data: { ferreteriaId: ferreteria.id, usuarioId: cajero.id, rol: "CAJERO" } });
    await prisma.ferreteriaUsuario.create({ data: { ferreteriaId: ferreteria.id, usuarioId: deposito.id, rol: "DEPOSITO" } });
  });

  afterAll(async () => {
    await prisma.ferreteria.delete({ where: { id: ferreteria.id } });
    await prisma.usuario.deleteMany({ where: { id: { in: [cajero.id, deposito.id, superAdmin.id] } } });
  });

  it("Cajero puede ver el catálogo pero no crear categorías (matriz: productos → Cajero solo 'ver')", async () => {
    sesionDe(cajero.id, ferreteria.id, "CAJERO");

    const resGet = await GET();
    expect(resGet.status).toBe(200);

    const resPost = await POST(new Request("http://test/api/categorias", { method: "POST", body: JSON.stringify({ nombre: "No debería crearse" }) }));
    expect(resPost.status).toBe(403);
  });

  it("Depósito sí puede crear categorías (matriz: productos → Depósito 'ver, crear, modificar')", async () => {
    sesionDe(deposito.id, ferreteria.id, "DEPOSITO");

    const resPost = await POST(new Request("http://test/api/categorias", { method: "POST", body: JSON.stringify({ nombre: "Clavos" }) }));
    expect(resPost.status).toBe(201);
  });

  it("Super Admin en modo soporte puede leer pero no escribir, aunque el rol prestado sea Dueño", async () => {
    sesionDe(superAdmin.id, ferreteria.id, "DUENO", { soporte: true });

    const resGet = await GET();
    expect(resGet.status).toBe(200);

    const resPost = await POST(new Request("http://test/api/categorias", { method: "POST", body: JSON.stringify({ nombre: "No debería crearse" }) }));
    expect(resPost.status).toBe(403);
  });
});
