import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";
import { crearFerreteriaConUsuario, borrarFixture } from "@/lib/test-fixtures";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";
import { POST } from "./route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

function sesionDe(usuarioId: string, ferreteriaId: string, rol: "DUENO" | "CAJERO" | "DEPOSITO") {
  mockAuth.mockResolvedValue({
    user: { id: usuarioId, ferreteriaId, ferreteriaNombre: "", rol, isSuperAdmin: false, soporte: false, emitidoEn: Date.now() },
  });
}

const pedir = (descripcion: string) =>
  POST(new Request("http://test/api/productos/rapido", { method: "POST", body: JSON.stringify({ descripcion }) }));

describe("/api/productos/rapido — alta mínima desde el punto de venta", () => {
  const sufijo = `rapido-${Date.now()}`;
  let ferreteria: { id: string };
  let cajero: { id: string };
  let deposito: { id: string };

  beforeAll(async () => {
    ({ ferreteria, usuario: cajero } = await crearFerreteriaConUsuario(sufijo, "CAJERO"));
    deposito = (await prisma.usuario.create({ data: { email: `${sufijo}-dep@test.gea`, estado: "ACTIVO" } }));
    await prisma.ferreteriaUsuario.create({ data: { ferreteriaId: ferreteria.id, usuarioId: deposito.id, rol: "DEPOSITO" } });
  });

  afterAll(async () => borrarFixture(ferreteria.id, [cajero.id, deposito.id]));

  it("un Cajero puede crear un producto solo con el nombre, aunque no tenga productos:crear", async () => {
    sesionDe(cajero.id, ferreteria.id, "CAJERO");
    const res = await pedir("Tornillo especial pedido por el cliente");
    expect(res.status).toBe(201);
    const { producto } = await res.json();
    expect(producto.descripcion).toBe("Tornillo especial pedido por el cliente");
    expect(producto.precioVenta).toBe("0");
    expect(producto.stockActual).toBe(0);
    expect(producto.codigo).toMatch(/^RAP-/);

    const enBase = await prisma.producto.findUnique({
      where: { id: producto.id },
      include: { subCategoria: { include: { categoria: true } }, marca: true },
    });
    expect(enBase?.subCategoria.categoria.nombre).toBe("Otros");
    expect(enBase?.subCategoria.nombre).toBe("Sin clasificar");
    expect(enBase?.marca.nombre).toBe("Sin marca (a revisar)");
  });

  it("reutiliza la misma categoría/marca 'pendiente' entre altas, no crea una por cada producto", async () => {
    sesionDe(cajero.id, ferreteria.id, "CAJERO");
    await pedir("Producto rápido A");
    await pedir("Producto rápido B");
    const categorias = await prisma.categoria.count({ where: { ferreteriaId: ferreteria.id, nombre: "Otros" } });
    const marcas = await prisma.marca.count({ where: { ferreteriaId: ferreteria.id, nombre: "Sin marca (a revisar)" } });
    expect(categorias).toBe(1);
    expect(marcas).toBe(1);
  });

  it("un Depósito (compras:crear) también puede", async () => {
    sesionDe(deposito.id, ferreteria.id, "DEPOSITO");
    const res = await pedir("Producto de una compra");
    expect(res.status).toBe(201);
  });

  it("rechaza sin sesión y con nombre vacío", async () => {
    mockAuth.mockResolvedValue(null);
    expect((await pedir("algo")).status).toBe(401);

    sesionDe(cajero.id, ferreteria.id, "CAJERO");
    expect((await pedir("")).status).toBe(400);
  });
});
