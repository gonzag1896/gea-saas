import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";
import { crearProductoSchema } from "@/lib/schemas-catalogo";
import { manejarErrorPrisma } from "@/lib/prisma-errors";

export async function GET() {
  const resultado = await requirePermiso("productos", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const productos = await prisma.producto.findMany({
    where: { ferreteriaId: resultado.contexto.ferreteriaId },
    include: { subCategoria: { select: { nombre: true } }, marca: { select: { nombre: true } } },
    orderBy: { descripcion: "asc" },
  });
  return NextResponse.json({ productos });
}

export async function POST(req: Request) {
  const resultado = await requirePermiso("productos", "crear");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const body = await req.json().catch(() => null);
  const parsed = crearProductoSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  try {
    // stockActual no se recibe del body — arranca en 0 siempre. Declarar
    // stock inicial es un ajuste de stock (Fase 9), no un campo del alta.
    const producto = await prisma.producto.create({
      data: {
        ferreteriaId: resultado.contexto.ferreteriaId,
        codigo: parsed.data.codigo,
        // "" -> undefined (NULL): dos productos sin código de barras no
        // deben chocar contra el UNIQUE(ferreteriaId, codigoBarras) — NULL
        // sí puede repetirse, un string vacío literal no.
        codigoBarras: parsed.data.codigoBarras || undefined,
        descripcion: parsed.data.descripcion,
        subCategoriaId: parsed.data.subCategoriaId,
        marcaId: parsed.data.marcaId,
        moneda: parsed.data.moneda,
        precioCosto: parsed.data.precioCosto,
        precioVenta: parsed.data.precioVenta,
        stockMinimo: parsed.data.stockMinimo,
        observaciones: parsed.data.observaciones,
      },
    });
    return NextResponse.json({ producto }, { status: 201 });
  } catch (error) {
    return manejarErrorPrisma(error, (target) =>
      target.includes("codigoBarras") ? "Ya existe un producto con ese código de barras." : "Ya existe un producto con ese código.");
  }
}
