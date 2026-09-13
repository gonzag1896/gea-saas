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

function sesionDe(usuarioId: string, ferreteriaId: string, rol: "DUENO" | "CAJERO" | "DEPOSITO") {
  mockAuth.mockResolvedValue({
    user: { id: usuarioId, ferreteriaId, ferreteriaNombre: "", rol, isSuperAdmin: false, soporte: false, emitidoEn: Date.now() },
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
