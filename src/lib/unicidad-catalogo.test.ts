import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { crearFerreteriaConUsuario, borrarFixture } from "@/lib/test-fixtures";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";
import { POST as crearMarca } from "@/app/api/marcas/route";
import { POST as crearSubCategoria } from "@/app/api/subcategorias/route";
import { POST as crearProveedor } from "@/app/api/proveedores/route";
import { prisma } from "@/lib/db";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

function sesionDe(usuarioId: string, ferreteriaId: string) {
  mockAuth.mockResolvedValue({
    user: { id: usuarioId, ferreteriaId, ferreteriaNombre: "", rol: "DUENO", isSuperAdmin: false, soporte: false, emitidoEn: Date.now() },
  });
}

// El UNIQUE parcial de Proveedor.rut (WHERE rut IS NOT NULL) es SQL escrito
// a mano en la migración, no declarado en el DSL de Prisma (ver
// prisma/schema.prisma) — este test confirma que igual dispara P2002,
// porque Prisma mapea el código de error 23505 de Postgres sin importar
// si conoce la constraint de antemano.
describe("unicidad por ferretería en los Maestros — todas devuelven 409, no 500", () => {
  const sufijo = `unicidad-${Date.now()}`;
  let ferreteria: { id: string };
  let dueno: { id: string };

  beforeAll(async () => {
    ({ ferreteria, usuario: dueno } = await crearFerreteriaConUsuario(sufijo, "DUENO"));
    sesionDe(dueno.id, ferreteria.id);
  });

  afterAll(async () => borrarFixture(ferreteria.id, [dueno.id]));

  it("Marca duplicada", async () => {
    await crearMarca(new Request("http://test", { method: "POST", body: JSON.stringify({ nombre: "Bosch" }) }));
    const res = await crearMarca(new Request("http://test", { method: "POST", body: JSON.stringify({ nombre: "Bosch" }) }));
    expect(res.status).toBe(409);
  });

  it("SubCategoria duplicada dentro de la misma Categoria", async () => {
    const categoria = await prisma.categoria.create({ data: { ferreteriaId: ferreteria.id, nombre: "Cat unicidad" } });
    await crearSubCategoria(new Request("http://test", { method: "POST", body: JSON.stringify({ nombre: "Sub", categoriaId: categoria.id }) }));
    const res = await crearSubCategoria(new Request("http://test", { method: "POST", body: JSON.stringify({ nombre: "Sub", categoriaId: categoria.id }) }));
    expect(res.status).toBe(409);
  });

  it("RUT de Proveedor duplicado (índice único parcial agregado a mano)", async () => {
    await crearProveedor(new Request("http://test", { method: "POST", body: JSON.stringify({ nombre: "Proveedor Uno", rut: "210000000015" }) }));
    const res = await crearProveedor(new Request("http://test", { method: "POST", body: JSON.stringify({ nombre: "Proveedor Dos", rut: "210000000015" }) }));
    expect(res.status).toBe(409);
  });

  it("dos Proveedores sin RUT no chocan entre sí (el índice único es parcial, solo aplica con rut cargado)", async () => {
    const res1 = await crearProveedor(new Request("http://test", { method: "POST", body: JSON.stringify({ nombre: "Sin Rut Uno" }) }));
    const res2 = await crearProveedor(new Request("http://test", { method: "POST", body: JSON.stringify({ nombre: "Sin Rut Dos" }) }));
    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
  });
});
