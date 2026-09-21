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
  return PATCH(new Request(`http://test/api/productos/${id}`, { method: "PATCH", body: JSON.stringify(body) }), { params: { id } });
}

// El caso concreto que motivó separar esto en tres permisos (ver
// schemas-catalogo.ts): Depósito carga y mantiene el catálogo día a día,
// pero ni fija precios ni da de baja un producto — eso es de Dueño.
describe("/api/productos/[id] — permisos separados por tipo de campo", () => {
  const sufijo = `productos-id-${Date.now()}`;
  let ferreteria: { id: string };
  let dueno: { id: string };
  let deposito: { id: string };
  let productoId: string;
  // crearFerreteriaConUsuario siempre crea una Ferretería nueva de
  // acompañante -- acá solo se necesita el Usuario (se suma como miembro
  // de `ferreteria` abajo), pero esa Ferretería "sobrante" hay que
  // capturarla igual para borrarla en afterAll o queda huérfana para
  // siempre en la base (bug real encontrado: 70 "Fixture ..." acumuladas).
  let ferreteriaSobrante: { id: string };

  beforeAll(async () => {
    ({ ferreteria, usuario: dueno } = await crearFerreteriaConUsuario(`${sufijo}-d`, "DUENO"));
    ({ ferreteria: ferreteriaSobrante, usuario: deposito } = await crearFerreteriaConUsuario(`${sufijo}-x`, "DEPOSITO"));
    await prisma.ferreteriaUsuario.create({ data: { ferreteriaId: ferreteria.id, usuarioId: deposito.id, rol: "DEPOSITO" } });

    const categoria = await prisma.categoria.create({ data: { ferreteriaId: ferreteria.id, nombre: "Cat" } });
    const subCategoria = await prisma.subCategoria.create({ data: { ferreteriaId: ferreteria.id, categoriaId: categoria.id, nombre: "Sub" } });
    const marca = await prisma.marca.create({ data: { ferreteriaId: ferreteria.id, nombre: "Marca" } });
    productoId = (await prisma.producto.create({
      data: { ferreteriaId: ferreteria.id, codigo: "P-1", descripcion: "Original", subCategoriaId: subCategoria.id, marcaId: marca.id, precioVenta: 100 },
    })).id;
  });

  afterAll(async () => {
    await borrarFixture(ferreteria.id, [dueno.id, deposito.id]);
    await prisma.ferreteria.delete({ where: { id: ferreteriaSobrante.id } });
  });

  it("Depósito puede modificar campos generales (descripción, stock mínimo)", async () => {
    sesionDe(deposito.id, ferreteria.id, "DEPOSITO");
    const res = await patch(productoId, { descripcion: "Actualizado por Depósito" });
    expect(res.status).toBe(200);
  });

  it("Depósito NO puede cambiar el precio", async () => {
    sesionDe(deposito.id, ferreteria.id, "DEPOSITO");
    const res = await patch(productoId, { precioVenta: 999 });
    expect(res.status).toBe(403);
  });

  it("Depósito NO puede desactivar el producto (esa es la acción 'eliminar', exclusiva de Dueño)", async () => {
    sesionDe(deposito.id, ferreteria.id, "DEPOSITO");
    const res = await patch(productoId, { activo: false });
    expect(res.status).toBe(403);
  });

  it("Dueño sí puede cambiar el precio, y queda auditado con el valor anterior y el nuevo", async () => {
    sesionDe(dueno.id, ferreteria.id, "DUENO");
    const res = await patch(productoId, { precioVenta: 250 });
    expect(res.status).toBe(200);

    const evento = await prisma.auditLog.findFirst({
      where: { accion: "PRODUCTO_PRECIO_CAMBIO", entidadId: productoId },
      orderBy: { createdAt: "desc" },
    });
    expect(evento?.detalle).toMatchObject({ precioVentaAnterior: "100", precioVentaNuevo: "250" });
  });

  it("Dueño sí puede desactivar el producto", async () => {
    sesionDe(dueno.id, ferreteria.id, "DUENO");
    const res = await patch(productoId, { activo: false });
    expect(res.status).toBe(200);
  });

  it("un PATCH vacío se rechaza con 400 en vez de un no-op silencioso", async () => {
    sesionDe(dueno.id, ferreteria.id, "DUENO");
    const res = await patch(productoId, {});
    expect(res.status).toBe(400);
  });
});
