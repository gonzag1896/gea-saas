import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";
import { productosStockBajo } from "@/lib/dashboard";
import { sugerirReposicion } from "@/lib/reposicion";

describe("stock bajo y reposición (filtrado en la base)", () => {
  const sufijo = `stockbajo-${Date.now()}`;
  let ferreteriaId: string;

  beforeAll(async () => {
    const ferreteria = await prisma.ferreteria.create({ data: { nombre: `Fixture ${sufijo}` } });
    ferreteriaId = ferreteria.id;
    const categoria = await prisma.categoria.create({ data: { ferreteriaId, nombre: "Cat" } });
    const sub = await prisma.subCategoria.create({ data: { ferreteriaId, categoriaId: categoria.id, nombre: "Sub" } });
    const marca = await prisma.marca.create({ data: { ferreteriaId, nombre: "Marca" } });
    const base = { ferreteriaId, subCategoriaId: sub.id, marcaId: marca.id };

    await prisma.producto.createMany({
      data: [
        { ...base, id: "sb-cero", codigo: "A", descripcion: "En cero", stockActual: 0, stockMinimo: 5 },      // falta 5
        { ...base, id: "sb-justo", codigo: "B", descripcion: "Justo en el mínimo", stockActual: 5, stockMinimo: 5 }, // falta 0
        { ...base, id: "sb-bajo", codigo: "C", descripcion: "Bajo", stockActual: 2, stockMinimo: 5 },         // falta 3
        { ...base, id: "sb-sano", codigo: "D", descripcion: "Sano sin ventas", stockActual: 50, stockMinimo: 5 },
        { ...base, id: "sb-inactivo", codigo: "E", descripcion: "Inactivo", stockActual: 0, stockMinimo: 5, activo: false },
        { ...base, id: "sb-rapido", codigo: "F", descripcion: "Sano pero se vende rápido", stockActual: 10, stockMinimo: 5 },
      ],
    });

    // "sb-rapido" vendió 60 unidades en el período: 2/día -> le quedan 5 días.
    const cliente = await prisma.cliente.create({ data: { ferreteriaId, nombre: "Cliente" } });
    const venta = await prisma.venta.create({
      data: { ferreteriaId, clienteId: cliente.id, fecha: new Date(), estado: "CONFIRMADO", totalUYU: 600, subtotalUYU: 600 },
    });
    await prisma.ventaDetalle.create({
      data: { ferreteriaId, ventaId: venta.id, productoId: "sb-rapido", precio: 10, moneda: "UYU", cantidad: 60, total: 600, totalVigente: 600 },
    });
  });

  afterAll(async () => {
    await prisma.ventaDetalle.deleteMany({ where: { ferreteriaId } });
    await prisma.venta.deleteMany({ where: { ferreteriaId } });
    await prisma.ferreteria.delete({ where: { id: ferreteriaId } });
  });

  it("stock bajo: solo activos en o bajo el mínimo, el mayor faltante primero", async () => {
    const lista = await productosStockBajo(ferreteriaId, 10);
    expect(lista.map((p) => p.id)).toEqual(["sb-cero", "sb-bajo", "sb-justo"]);
  });

  it("stock bajo: respeta el límite", async () => {
    expect(await productosStockBajo(ferreteriaId, 1)).toHaveLength(1);
  });

  it("stock bajo: no mezcla ferreterías", async () => {
    expect(await productosStockBajo("no-existe", 10)).toEqual([]);
  });

  it("reposición: incluye lo bajo el mínimo y lo que se agota pronto, no lo sano sin movimiento", async () => {
    const ids = (await sugerirReposicion(ferreteriaId)).map((s) => s.id);
    expect(ids).toContain("sb-rapido");
    expect(ids).toEqual(expect.arrayContaining(["sb-cero", "sb-bajo", "sb-justo"]));
    expect(ids).not.toContain("sb-sano");
    expect(ids).not.toContain("sb-inactivo");
  });
});
