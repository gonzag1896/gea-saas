import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";
import { crearFerreteriaConUsuario } from "@/lib/test-fixtures";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";
import { POST } from "./route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

function sesionDe(usuarioId: string, ferreteriaId: string, rol: "DUENO" | "CAJERO" | "DEPOSITO") {
  mockAuth.mockResolvedValue({
    user: { id: usuarioId, ferreteriaId, ferreteriaNombre: "", rol, isSuperAdmin: false, soporte: false, emitidoEn: Date.now() },
  });
}

describe("permisos por rol — /api/productos/[id]/ajuste-stock", () => {
  const sufijo = `ajuste-permisos-${Date.now()}`;
  let ferreteria: { id: string };
  let cajero: { id: string };
  let deposito: { id: string };
  // crearFerreteriaConUsuario siempre crea una Ferretería nueva — acá solo
  // hace falta el Usuario "depósito" (se suma como miembro de `ferreteria`
  // abajo), pero la Ferretería que trae de acompañante hay que capturarla
  // igual para poder borrarla en afterAll; si no, queda huérfana para
  // siempre en la base — exactamente lo que pasaba antes de este fix.
  let ferreteriaSobranteDeposito: { id: string };
  let productoId: string;

  beforeAll(async () => {
    ({ ferreteria, usuario: cajero } = await crearFerreteriaConUsuario(`${sufijo}-c`, "CAJERO"));
    ({ ferreteria: ferreteriaSobranteDeposito, usuario: deposito } = await crearFerreteriaConUsuario(`${sufijo}-x`, "DEPOSITO"));
    await prisma.ferreteriaUsuario.create({ data: { ferreteriaId: ferreteria.id, usuarioId: deposito.id, rol: "DEPOSITO" } });

    const categoria = await prisma.categoria.create({ data: { ferreteriaId: ferreteria.id, nombre: "Cat" } });
    const subCategoria = await prisma.subCategoria.create({ data: { ferreteriaId: ferreteria.id, categoriaId: categoria.id, nombre: "Sub" } });
    const marca = await prisma.marca.create({ data: { ferreteriaId: ferreteria.id, nombre: "Marca" } });
    productoId = (await prisma.producto.create({
      data: { ferreteriaId: ferreteria.id, codigo: "P-AJ-PERM", descripcion: "Producto", subCategoriaId: subCategoria.id, marcaId: marca.id },
    })).id;
  });

  afterAll(async () => {
    await prisma.movimientoStock.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.producto.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.ferreteria.delete({ where: { id: ferreteria.id } });
    await prisma.ferreteria.delete({ where: { id: ferreteriaSobranteDeposito.id } });
    await prisma.usuario.deleteMany({ where: { id: { in: [cajero.id, deposito.id] } } });
  });

  function cuerpo() {
    return new Request("http://test", { method: "POST", body: JSON.stringify({ tipo: "AJUSTE_POSITIVO", cantidad: 5, motivo: "test" }) });
  }

  it("Cajero no puede ajustar stock (matriz: ajustesStock → Cajero sin acceso)", async () => {
    sesionDe(cajero.id, ferreteria.id, "CAJERO");
    const res = await POST(cuerpo(), { params: { id: productoId } });
    expect(res.status).toBe(403);
  });

  it("Depósito sí puede ajustar stock", async () => {
    sesionDe(deposito.id, ferreteria.id, "DEPOSITO");
    const res = await POST(cuerpo(), { params: { id: productoId } });
    expect(res.status).toBe(200);
  });

  it("sin motivo, se rechaza con 400", async () => {
    sesionDe(deposito.id, ferreteria.id, "DEPOSITO");
    const res = await POST(
      new Request("http://test", { method: "POST", body: JSON.stringify({ tipo: "AJUSTE_POSITIVO", cantidad: 5, motivo: "" }) }),
      { params: { id: productoId } },
    );
    expect(res.status).toBe(400);
  });
});
