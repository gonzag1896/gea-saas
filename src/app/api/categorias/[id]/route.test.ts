import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";
import { crearFerreteriaConUsuario, borrarFixture } from "@/lib/test-fixtures";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";
import { PATCH } from "./route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

function sesionDe(usuarioId: string, ferreteriaId: string, rol: "DUENO" | "CAJERO" | "DEPOSITO") {
  mockAuth.mockResolvedValue({
    user: { id: usuarioId, ferreteriaId, ferreteriaNombre: "", rol, isSuperAdmin: false, soporte: false, emitidoEn: Date.now() },
  });
}

function patch(id: string, body: unknown) {
  return PATCH(new Request(`http://test/api/categorias/${id}`, { method: "PATCH", body: JSON.stringify(body) }), { params: { id } });
}

// Regresión de un bug real encontrado a mano: al principio "activo" viajaba
// bajo el mismo permiso genérico "modificar" que el nombre, lo que le
// hubiera dado a Depósito la posibilidad de desactivar categorías — cuando
// la matriz dice que la baja lógica ("eliminar") es exclusiva de Dueño.
describe("/api/categorias/[id] — activar/desactivar exige 'eliminar', no 'modificar'", () => {
  const sufijo = `cat-id-${Date.now()}`;
  let ferreteria: { id: string };
  let dueno: { id: string };
  let deposito: { id: string };
  let categoriaId: string;

  beforeAll(async () => {
    ({ ferreteria, usuario: dueno } = await crearFerreteriaConUsuario(`${sufijo}-d`, "DUENO"));
    deposito = (await crearFerreteriaConUsuario(`${sufijo}-x`, "DEPOSITO")).usuario;
    await prisma.ferreteriaUsuario.create({ data: { ferreteriaId: ferreteria.id, usuarioId: deposito.id, rol: "DEPOSITO" } });
    categoriaId = (await prisma.categoria.create({ data: { ferreteriaId: ferreteria.id, nombre: "Herramientas" } })).id;
  });

  afterAll(async () => borrarFixture(ferreteria.id, [dueno.id, deposito.id]));

  it("Depósito puede renombrar (tiene 'modificar')", async () => {
    sesionDe(deposito.id, ferreteria.id, "DEPOSITO");
    const res = await patch(categoriaId, { nombre: "Herramientas Eléctricas" });
    expect(res.status).toBe(200);
  });

  it("Depósito NO puede desactivar (no tiene 'eliminar')", async () => {
    sesionDe(deposito.id, ferreteria.id, "DEPOSITO");
    const res = await patch(categoriaId, { activo: false });
    expect(res.status).toBe(403);
  });

  it("Dueño sí puede desactivar", async () => {
    sesionDe(dueno.id, ferreteria.id, "DUENO");
    const res = await patch(categoriaId, { activo: false });
    expect(res.status).toBe(200);
  });
});
