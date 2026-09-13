import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/db";

// Prueba automatizada de la garantía verificada a mano en Fase 2: ninguna
// fila hija puede quedar cruzada entre dos ferreterías, porque cada FK
// hacia un padre tenant-scoped es compuesta (padreId, ferreteriaId) — ver
// el encabezado de prisma/schema.prisma. Esto es lo que compensa no tener
// una capa de repositorios ni Row-Level Security: el motor rechaza el
// cruce aunque el código de aplicación se equivoque.
describe("FK compuesta — ninguna fila cruza de ferretería", () => {
  const sufijo = `test-fk-${Date.now()}`;
  let ferreteriaA: { id: string };
  let ferreteriaB: { id: string };
  let categoriaA: { id: string };
  let subCategoriaA: { id: string };
  let marcaA: { id: string };

  beforeAll(async () => {
    ferreteriaA = await prisma.ferreteria.create({ data: { nombre: `A ${sufijo}` } });
    ferreteriaB = await prisma.ferreteria.create({ data: { nombre: `B ${sufijo}` } });
    categoriaA = await prisma.categoria.create({ data: { ferreteriaId: ferreteriaA.id, nombre: "Cat A" } });
    subCategoriaA = await prisma.subCategoria.create({ data: { ferreteriaId: ferreteriaA.id, categoriaId: categoriaA.id, nombre: "Sub A" } });
    marcaA = await prisma.marca.create({ data: { ferreteriaId: ferreteriaA.id, nombre: "Marca A" } });
  });

  afterAll(async () => {
    await prisma.ferreteria.deleteMany({ where: { id: { in: [ferreteriaA.id, ferreteriaB.id] } } });
  });

  it("una SubCategoria de B no puede colgar de una Categoria de A", async () => {
    await expect(
      prisma.subCategoria.create({ data: { ferreteriaId: ferreteriaB.id, categoriaId: categoriaA.id, nombre: "Intento cruzado" } }),
    ).rejects.toThrow();
  });

  it("un Producto de B no puede referenciar la SubCategoria de A", async () => {
    const marcaB = await prisma.marca.create({ data: { ferreteriaId: ferreteriaB.id, nombre: "Marca B" } });
    await expect(
      prisma.producto.create({
        data: {
          ferreteriaId: ferreteriaB.id,
          codigo: "X-1",
          descripcion: "Intento cruzado",
          subCategoriaId: subCategoriaA.id,
          marcaId: marcaB.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("un Producto de B no puede referenciar la Marca de A", async () => {
    const subCategoriaB = await prisma.subCategoria.create({
      data: { ferreteriaId: ferreteriaB.id, categoriaId: (await prisma.categoria.create({ data: { ferreteriaId: ferreteriaB.id, nombre: "Cat B" } })).id, nombre: "Sub B" },
    });
    await expect(
      prisma.producto.create({
        data: {
          ferreteriaId: ferreteriaB.id,
          codigo: "X-2",
          descripcion: "Intento cruzado",
          subCategoriaId: subCategoriaB.id,
          marcaId: marcaA.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("dentro de la misma ferretería, la misma combinación funciona sin problema", async () => {
    const producto = await prisma.producto.create({
      data: {
        ferreteriaId: ferreteriaA.id,
        codigo: "OK-1",
        descripcion: "Producto normal",
        subCategoriaId: subCategoriaA.id,
        marcaId: marcaA.id,
      },
    });
    expect(producto.id).toBeDefined();
  });
});
