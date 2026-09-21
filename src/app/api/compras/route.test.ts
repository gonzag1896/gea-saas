import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";
import { crearFerreteriaConUsuario } from "@/lib/test-fixtures";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";
import { POST } from "./route";
import { POST as anular } from "./[id]/anular/route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

function sesionDe(usuarioId: string, ferreteriaId: string, rol: "DUENO" | "CAJERO" | "DEPOSITO") {
  mockAuth.mockResolvedValue({
    user: { id: usuarioId, ferreteriaId, ferreteriaNombre: "", rol, isSuperAdmin: false, soporte: false, emitidoEn: Date.now() },
  });
}

// Caso explícito del criterio de terminado de Fase 5 ("un Cajero que
// intenta anular una Compra recibe 403") — ahora que la ruta existe de
// verdad, no hace falta simularlo con otro endpoint.
describe("permisos por rol — /api/compras", () => {
  const sufijo = `compras-permisos-${Date.now()}`;
  let ferreteria: { id: string };
  let cajero: { id: string };
  let deposito: { id: string };
  let dueno: { id: string };
  let proveedorId: string;
  let productoId: string;
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

    proveedorId = (await prisma.proveedor.create({ data: { ferreteriaId: ferreteria.id, nombre: "Proveedor" } })).id;
    const categoria = await prisma.categoria.create({ data: { ferreteriaId: ferreteria.id, nombre: "Cat" } });
    const subCategoria = await prisma.subCategoria.create({ data: { ferreteriaId: ferreteria.id, categoriaId: categoria.id, nombre: "Sub" } });
    const marca = await prisma.marca.create({ data: { ferreteriaId: ferreteria.id, nombre: "Marca" } });
    productoId = (await prisma.producto.create({
      data: { ferreteriaId: ferreteria.id, codigo: "P-PERM", descripcion: "Producto", subCategoriaId: subCategoria.id, marcaId: marca.id },
    })).id;
  });

  afterAll(async () => {
    await prisma.movimientoStock.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.compraDetalle.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.compra.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.producto.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.ferreteria.delete({ where: { id: ferreteria.id } });
    await prisma.ferreteria.delete({ where: { id: ferreteriaSobranteCajero.id } });
    await prisma.ferreteria.delete({ where: { id: ferreteriaSobranteDeposito.id } });
    await prisma.usuario.deleteMany({ where: { id: { in: [dueno.id, cajero.id, deposito.id] } } });
  });

  function cuerpoCompra() {
    return new Request("http://test/api/compras", {
      method: "POST",
      body: JSON.stringify({
        proveedorId,
        fecha: new Date().toISOString(),
        detalle: [{ productoId, cantidad: 1, costoUnitario: 10, tipoIva: "EXENTO" }],
      }),
    });
  }

  it("Cajero no puede crear compras (matriz: compras → Cajero sin ningún acceso)", async () => {
    sesionDe(cajero.id, ferreteria.id, "CAJERO");
    const res = await POST(cuerpoCompra());
    expect(res.status).toBe(403);
  });

  it("Depósito puede crear (queda confirmada de una), pero no anular", async () => {
    sesionDe(deposito.id, ferreteria.id, "DEPOSITO");
    const resCrear = await POST(cuerpoCompra());
    expect(resCrear.status).toBe(201);
    const { compra } = await resCrear.json();
    expect(compra.estado).toBe("CONFIRMADO");

    const resAnular = await anular(
      new Request("http://test", { method: "POST", body: JSON.stringify({ motivo: "test" }) }),
      { params: { id: compra.id } },
    );
    expect(resAnular.status).toBe(403);
  });

  it("Dueño puede crear (queda confirmada de una) y anular", async () => {
    sesionDe(dueno.id, ferreteria.id, "DUENO");
    const resCrear = await POST(cuerpoCompra());
    const { compra } = await resCrear.json();
    expect(compra.estado).toBe("CONFIRMADO");

    const resAnular = await anular(
      new Request("http://test", { method: "POST", body: JSON.stringify({ motivo: "test" }) }),
      { params: { id: compra.id } },
    );
    expect(resAnular.status).toBe(200);
  });
});
