import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";
import { crearMarcaSchema } from "@/lib/schemas-catalogo";
import { manejarErrorPrisma } from "@/lib/prisma-errors";

export async function GET() {
  const resultado = await requirePermiso("productos", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const marcas = await prisma.marca.findMany({
    where: { ferreteriaId: resultado.contexto.ferreteriaId },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json({ marcas });
}

export async function POST(req: Request) {
  const resultado = await requirePermiso("productos", "crear");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const body = await req.json().catch(() => null);
  const parsed = crearMarcaSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  try {
    const marca = await prisma.marca.create({
      data: { ferreteriaId: resultado.contexto.ferreteriaId, nombre: parsed.data.nombre },
    });
    return NextResponse.json({ marca }, { status: 201 });
  } catch (error) {
    return manejarErrorPrisma(error, "Ya existe una marca con ese nombre.");
  }
}
