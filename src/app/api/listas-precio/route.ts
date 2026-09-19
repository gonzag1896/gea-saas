import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";
import { crearListaPrecioSchema } from "@/lib/schemas-catalogo";
import { manejarErrorPrisma } from "@/lib/prisma-errors";

export async function GET() {
  const resultado = await requirePermiso("listasPrecio", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const listas = await prisma.listaPrecio.findMany({
    where: { ferreteriaId: resultado.contexto.ferreteriaId },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json({ listas });
}

export async function POST(req: Request) {
  const resultado = await requirePermiso("listasPrecio", "crear");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const body = await req.json().catch(() => null);
  const parsed = crearListaPrecioSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  try {
    const lista = await prisma.listaPrecio.create({
      data: { ferreteriaId: resultado.contexto.ferreteriaId, nombre: parsed.data.nombre },
    });
    return NextResponse.json({ lista }, { status: 201 });
  } catch (error) {
    return manejarErrorPrisma(error, "Ya existe una lista de precio con ese nombre.");
  }
}
