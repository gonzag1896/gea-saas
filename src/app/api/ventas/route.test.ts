import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";
import { crearFerreteriaConUsuario } from "@/lib/test-fixtures";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";
import { POST } from "./route";
import { POST as confirmar } from "./[id]/confirmar/route";
import { POST as anular } from "./[id]/anular/route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

function sesionDe(usuarioId: string, ferreteriaId: string, rol: "DUENO" | "CAJERO" | "DEPOSITO") {
  mockAuth.mockResolvedValue({
    user: { id: usuarioId, ferreteriaId, ferreteriaNombre: "", rol, isSuperAdmin: false, soporte: false, emitidoEn: Date.now() },
  });
}

// Caso literal del criterio de terminado de Fase 5: "un Cajero que intenta
// anular una Venta recibe 403" (ahí se probó con Compras porque Ventas
// todavía no existía).
describe("permisos por rol — /api/ventas", () => {
  const sufijo = `ventas-permisos-${Date.now()}`;
  let ferreteria: { id: string };
  let cajero: { id: string };
  let deposito: { id: string };
  let dueno: { id: string };
  let clienteId: string;
  let productoId: string;

  beforeAll(async () => {
    ({ ferreteria, usuario: dueno } = await crearFerreteriaConUsuario(`${sufijo}-d`, "DUENO"));
    cajero = (await crearFerreteriaConUsuario(`${sufijo}-c`, "CAJERO")).usuario;
    deposito = (await crearFerreteriaConUsuario(`${sufijo}-x`, "DEPOSITO")).usuario;
    await prisma.ferreteriaUsuario.create({ data: { ferreteriaId: ferreteria.id, usuarioId: cajero.id, rol: "CAJERO" } });
    await prisma.ferreteriaUsuario.create({ data: { ferreteriaId: ferreteria.id, usuarioId: deposito.id, rol: "DEPOSITO" } });

    clienteId = (await prisma.cliente.create({ data: { ferreteriaId: ferreteria.id, nombre: "Cliente" } })).id;
    const categoria = await prisma.categoria.create({ data: { ferreteriaId: ferreteria.id, nombre: "Cat" } });
    const subCategoria = await prisma.subCategoria.create({ data: { ferreteriaId: ferreteria.id, categoriaId: categoria.id, nombre: "Sub" } });
    const marca = await prisma.marca.create({ data: { ferreteriaId: ferreteria.id, nombre: "Marca" } });
    productoId = (await prisma.producto.create({
      data: { ferreteriaId: ferreteria.id, codigo: "P-PERM-V", descripcion: "Producto", subCategoriaId: subCategoria.id, marcaId: marca.id, stockActual: 50 },
    })).id;
  });

  afterAll(async () => {
    await prisma.cuentaCliente.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.movimientoStock.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.ventaDetalle.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.venta.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.cliente.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.producto.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.ferreteria.delete({ where: { id: ferreteria.id } });
    await prisma.usuario.deleteMany({ where: { id: { in: [dueno.id, cajero.id, deposito.id] } } });
  });

  function cuerpoVenta() {
    return new Request("http://test/api/ventas", {
      method: "POST",
      body: JSON.stringify({
        clienteId,
        fecha: new Date().toISOString(),
        detalle: [{ productoId, cantidad: 1, precio: 100 }],
      }),
    });
  }

  it("Depósito no puede crear ventas (matriz: ventas → Depósito sin ningún acceso)", async () => {
    sesionDe(deposito.id, ferreteria.id, "DEPOSITO");
    const res = await POST(cuerpoVenta());
    expect(res.status).toBe(403);
  });

  it("Cajero puede crear y confirmar, pero no anular", async () => {
    sesionDe(cajero.id, ferreteria.id, "CAJERO");
    const resCrear = await POST(cuerpoVenta());
    expect(resCrear.status).toBe(201);
    const { venta } = await resCrear.json();

    const resConfirmar = await confirmar(new Request("http://test", { method: "POST" }), { params: { id: venta.id } });
    expect(resConfirmar.status).toBe(200);

    const resAnular = await anular(
      new Request("http://test", { method: "POST", body: JSON.stringify({ motivo: "test" }) }),
      { params: { id: venta.id } },
    );
    expect(resAnular.status).toBe(403);
  });

  it("Dueño puede crear, confirmar y anular", async () => {
    sesionDe(dueno.id, ferreteria.id, "DUENO");
    const resCrear = await POST(cuerpoVenta());
    const { venta } = await resCrear.json();

    await confirmar(new Request("http://test", { method: "POST" }), { params: { id: venta.id } });
    const resAnular = await anular(
      new Request("http://test", { method: "POST", body: JSON.stringify({ motivo: "test" }) }),
      { params: { id: venta.id } },
    );
    expect(resAnular.status).toBe(200);
  });
});
