import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";
import { crearFerreteriaConUsuario, borrarFixture } from "@/lib/test-fixtures";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";
import { GET, POST } from "./route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

function sesionDe(usuarioId: string, ferreteriaId: string, rol: "DUENO" | "CAJERO" | "DEPOSITO") {
  mockAuth.mockResolvedValue({
    user: { id: usuarioId, ferreteriaId, ferreteriaNombre: "", rol, isSuperAdmin: false, soporte: false, emitidoEn: Date.now() },
  });
}

describe("/api/productos — creación y unicidad", () => {
  const sufijo = `productos-${Date.now()}`;
  let ferreteria: { id: string };
  let dueno: { id: string };
  let subCategoriaId: string;
  let marcaId: string;

  beforeAll(async () => {
    ({ ferreteria, usuario: dueno } = await crearFerreteriaConUsuario(sufijo, "DUENO"));
    const categoria = await prisma.categoria.create({ data: { ferreteriaId: ferreteria.id, nombre: "Cat" } });
    subCategoriaId = (await prisma.subCategoria.create({ data: { ferreteriaId: ferreteria.id, categoriaId: categoria.id, nombre: "Sub" } })).id;
    marcaId = (await prisma.marca.create({ data: { ferreteriaId: ferreteria.id, nombre: "Marca" } })).id;
  });

  afterAll(async () => borrarFixture(ferreteria.id, [dueno.id]));

  it("crea un producto con stockActual en 0 aunque no se lo pidan", async () => {
    sesionDe(dueno.id, ferreteria.id, "DUENO");
    const res = await POST(new Request("http://test/api/productos", {
      method: "POST",
      body: JSON.stringify({ codigo: "COD-1", descripcion: "Martillo", subCategoriaId, marcaId, precioVenta: 500 }),
    }));
    expect(res.status).toBe(201);
    const { producto } = await res.json();
    expect(producto.stockActual).toBe(0);
  });

  it("rechaza un código de producto duplicado dentro de la misma ferretería con 409, no 500", async () => {
    sesionDe(dueno.id, ferreteria.id, "DUENO");
    const res = await POST(new Request("http://test/api/productos", {
      method: "POST",
      body: JSON.stringify({ codigo: "COD-1", descripcion: "Otro producto, mismo código", subCategoriaId, marcaId }),
    }));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toMatch(/código/i);
  });

  it("el listado incluye subCategoria y marca por su nombre, no solo el id", async () => {
    sesionDe(dueno.id, ferreteria.id, "DUENO");
    const res = await GET();
    const { productos } = await res.json();
    expect(productos[0].subCategoria.nombre).toBe("Sub");
    expect(productos[0].marca.nombre).toBe("Marca");
  });
});
