import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { prisma } from "@/lib/db";
import { crearFerreteriaConUsuario, borrarFixture } from "@/lib/test-fixtures";

vi.mock("@/lib/auth", () => ({ auth: vi.fn() }));
import { auth } from "@/lib/auth";
import { GET } from "./route";

const mockAuth = auth as unknown as ReturnType<typeof vi.fn>;

function sesionDe(usuarioId: string, ferreteriaId: string, rol: "DUENO" | "CAJERO" | "DEPOSITO") {
  mockAuth.mockResolvedValue({
    user: { id: usuarioId, ferreteriaId, ferreteriaNombre: "", rol, isSuperAdmin: false, soporte: false, emitidoEn: Date.now() },
  });
}

const pedir = (query: string) => GET(new Request(`http://test/api/productos/buscar?${query}`));

describe("/api/productos/buscar", () => {
  const sufijo = `buscar-${Date.now()}`;
  let ferreteria: { id: string };
  let otra: { id: string };
  let cajero: { id: string };
  let otroUsuario: { id: string };
  let listaId: string;
  let tornilloId: string;

  beforeAll(async () => {
    ({ ferreteria, usuario: cajero } = await crearFerreteriaConUsuario(sufijo, "CAJERO"));
    ({ ferreteria: otra, usuario: otroUsuario } = await crearFerreteriaConUsuario(`${sufijo}-otra`, "DUENO"));

    async function catalogo(ferreteriaId: string) {
      const categoria = await prisma.categoria.create({ data: { ferreteriaId, nombre: "Cat" } });
      const sub = await prisma.subCategoria.create({ data: { ferreteriaId, categoriaId: categoria.id, nombre: "Sub" } });
      const marca = await prisma.marca.create({ data: { ferreteriaId, nombre: "Marca" } });
      return { subCategoriaId: sub.id, marcaId: marca.id };
    }
    const base = await catalogo(ferreteria.id);
    const baseOtra = await catalogo(otra.id);

    const tornillo = await prisma.producto.create({
      data: { ferreteriaId: ferreteria.id, ...base, codigo: "TOR-6", codigoBarras: "7790001", descripcion: "Tornillo Hexagonal 6mm", precioVenta: 10 },
    });
    tornilloId = tornillo.id;
    await prisma.producto.create({ data: { ferreteriaId: ferreteria.id, ...base, codigo: "MAR-1", descripcion: "Martillo carpintero", precioVenta: 500 } });
    await prisma.producto.create({ data: { ferreteriaId: ferreteria.id, ...base, codigo: "VIEJO", descripcion: "Tornillo descontinuado", activo: false } });
    await prisma.producto.create({ data: { ferreteriaId: otra.id, ...baseOtra, codigo: "TOR-9", descripcion: "Tornillo de otra ferretería" } });

    const lista = await prisma.listaPrecio.create({ data: { ferreteriaId: ferreteria.id, nombre: "Mayorista" } });
    listaId = lista.id;
    await prisma.precioProducto.create({ data: { ferreteriaId: ferreteria.id, listaPrecioId: listaId, productoId: tornilloId, precio: 7 } });
  });

  afterAll(async () => {
    await borrarFixture(ferreteria.id, [cajero.id]);
    await borrarFixture(otra.id, [otroUsuario.id]);
  });

  it("busca por palabras parciales en cualquier orden, sin distinguir mayúsculas", async () => {
    sesionDe(cajero.id, ferreteria.id, "CAJERO");
    const { productos } = await (await pedir("q=6MM%20hexag")).json();
    expect(productos.map((p: { codigo: string }) => p.codigo)).toEqual(["TOR-6"]);
  });

  it("no devuelve productos inactivos ni de otra ferretería", async () => {
    sesionDe(cajero.id, ferreteria.id, "CAJERO");
    const { productos } = await (await pedir("q=tornillo")).json();
    expect(productos.map((p: { codigo: string }) => p.codigo)).toEqual(["TOR-6"]);
  });

  it("encuentra por código de barras exacto", async () => {
    sesionDe(cajero.id, ferreteria.id, "CAJERO");
    const { productos } = await (await pedir("codigoBarras=7790001")).json();
    expect(productos).toHaveLength(1);
    expect(productos[0].id).toBe(tornilloId);
  });

  it("devuelve el precio de la lista del cliente cuando el producto lo tiene", async () => {
    sesionDe(cajero.id, ferreteria.id, "CAJERO");
    const conLista = (await (await pedir(`id=${tornilloId}&listaPrecioId=${listaId}`)).json()).productos[0];
    expect(conLista.precioVenta).toBe("7");
    expect(conLista.precioDeLista).toBe(true);

    const sinLista = (await (await pedir(`id=${tornilloId}`)).json()).productos[0];
    expect(sinLista.precioVenta).toBe("10");
    expect(sinLista.precioDeLista).toBe(false);
  });

  it("rechaza sin sesión", async () => {
    mockAuth.mockResolvedValue(null);
    expect((await pedir("q=x")).status).toBe(401);
  });
});
