import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { crearFerreteriaConUsuario, borrarFixture } from "@/lib/test-fixtures";
import { registrarAjusteStock, StockInsuficienteError } from "@/lib/stock";
import { confirmarCompra } from "@/lib/compras";
import { confirmarVenta, registrarDevolucionVenta } from "@/lib/ventas";

describe("stock — ajuste manual", () => {
  const sufijo = `stock-${Date.now()}`;
  let ferreteria: { id: string };
  let dueno: { id: string };
  let productoId: string;

  beforeAll(async () => {
    ({ ferreteria, usuario: dueno } = await crearFerreteriaConUsuario(sufijo, "DUENO"));
    const categoria = await prisma.categoria.create({ data: { ferreteriaId: ferreteria.id, nombre: "Cat" } });
    const subCategoria = await prisma.subCategoria.create({ data: { ferreteriaId: ferreteria.id, categoriaId: categoria.id, nombre: "Sub" } });
    const marca = await prisma.marca.create({ data: { ferreteriaId: ferreteria.id, nombre: "Marca" } });
    productoId = (await prisma.producto.create({
      data: { ferreteriaId: ferreteria.id, codigo: "P-STOCK", descripcion: "Producto de prueba", subCategoriaId: subCategoria.id, marcaId: marca.id },
    })).id;
  });

  afterAll(async () => {
    await prisma.cuentaCliente.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.movimientoStock.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.devolucionVenta.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.ventaDetalle.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.venta.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.compraDetalle.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.compra.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await prisma.producto.deleteMany({ where: { ferreteriaId: ferreteria.id } });
    await borrarFixture(ferreteria.id, [dueno.id]);
  });

  async function stockDelProducto() {
    return (await prisma.producto.findUniqueOrThrow({ where: { id: productoId } })).stockActual;
  }

  it("ajuste positivo suma stock y queda registrado como AJUSTE_POSITIVO / origen AJUSTE", async () => {
    const antes = await stockDelProducto();
    await registrarAjusteStock(ferreteria.id, productoId, "AJUSTE_POSITIVO", 50, "Carga inicial de inventario", dueno.id);
    expect((await stockDelProducto()) - antes).toBe(50);

    const movimiento = await prisma.movimientoStock.findFirst({ where: { productoId, tipo: "AJUSTE_POSITIVO" } });
    expect(movimiento).toMatchObject({ origenTipo: "AJUSTE", cantidad: 50, motivo: "Carga inicial de inventario" });
  });

  it("ajuste negativo resta stock", async () => {
    const antes = await stockDelProducto();
    await registrarAjusteStock(ferreteria.id, productoId, "AJUSTE_NEGATIVO", 10, "Rotura", dueno.id);
    expect(antes - (await stockDelProducto())).toBe(10);
  });

  it("un ajuste negativo que dejaría el stock en negativo se rechaza, sin tocar nada", async () => {
    const antes = await stockDelProducto();
    await expect(
      registrarAjusteStock(ferreteria.id, productoId, "AJUSTE_NEGATIVO", antes + 1000, "motivo", dueno.id),
    ).rejects.toThrow(StockInsuficienteError);
    expect(await stockDelProducto()).toBe(antes);
  });

  // Criterio de terminado literal de la Fase 9: stockActual siempre
  // reconstruible sumando el historial de movimientos — probado con una
  // secuencia real que mezcla ajustes, una compra y una venta con
  // devolución parcial, no solo ajustes sueltos.
  it("stockActual es siempre reconstruible sumando todo el historial de MovimientoStock", async () => {
    const proveedorId = (await prisma.proveedor.create({ data: { ferreteriaId: ferreteria.id, nombre: "Proveedor Stock Test" } })).id;
    const clienteId = (await prisma.cliente.create({ data: { ferreteriaId: ferreteria.id, nombre: "Cliente Stock Test" } })).id;

    await registrarAjusteStock(ferreteria.id, productoId, "AJUSTE_POSITIVO", 20, "ajuste 1", dueno.id);

    const compra = await prisma.compra.create({
      data: {
        ferreteriaId: ferreteria.id, proveedorId, fecha: new Date(), subtotal: 100, iva: 0, total: 100,
        detalle: { create: [{ productoId, cantidad: 15, costoUnitario: 10, subtotal: 150 }] },
      },
    });
    await confirmarCompra(ferreteria.id, compra.id, dueno.id);

    const venta = await prisma.venta.create({
      data: {
        ferreteriaId: ferreteria.id, clienteId, fecha: new Date(), subtotal: 80, iva: 0, total: 80,
        detalle: { create: [{ productoId, cantidad: 8, precio: 10, total: 80, totalVigente: 80 }] },
      },
    });
    await confirmarVenta(ferreteria.id, venta.id, dueno.id);

    const detalleVenta = await prisma.ventaDetalle.findFirstOrThrow({ where: { ventaId: venta.id } });
    await registrarDevolucionVenta(ferreteria.id, detalleVenta.id, 2, "no le gustó", dueno.id);

    const movimientos = await prisma.movimientoStock.findMany({ where: { productoId } });
    const reconstruido = movimientos.reduce((acc, m) => {
      const esEntrada = m.tipo === "ENTRADA" || m.tipo === "AJUSTE_POSITIVO";
      return acc + (esEntrada ? m.cantidad : -m.cantidad);
    }, 0);

    expect(reconstruido).toBe(await stockDelProducto());
  });
});
