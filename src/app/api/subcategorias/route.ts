import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";
import { crearSubCategoriaSchema } from "@/lib/schemas-catalogo";
import { manejarErrorPrisma } from "@/lib/prisma-errors";

export async function GET() {
  const resultado = await requirePermiso("productos", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const subCategorias = await prisma.subCategoria.findMany({
    where: { ferreteriaId: resultado.contexto.ferreteriaId },
    include: { categoria: { select: { nombre: true } } },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json({ subCategorias });
}

export async function POST(req: Request) {
  const resultado = await requirePermiso("productos", "crear");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const body = await req.json().catch(() => null);
  const parsed = crearSubCategoriaSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  try {
    // categoriaId + ferreteriaId compuesta: si el id de categoría no es de
    // esta ferretería, la FK compuesta rechaza el insert (ver
    // schema.prisma) en vez de colgar la subcategoría de una categoría ajena.
    const subCategoria = await prisma.subCategoria.create({
      data: {
        ferreteriaId: resultado.contexto.ferreteriaId,
        categoriaId: parsed.data.categoriaId,
        nombre: parsed.data.nombre,
      },
    });
    return NextResponse.json({ subCategoria }, { status: 201 });
  } catch (error) {
    return manejarErrorPrisma(error, "Ya existe una familia con ese nombre en esa categoría.");
  }
}
