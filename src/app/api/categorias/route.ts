import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";
import { crearCategoriaSchema } from "@/lib/schemas-catalogo";

// Categorías cae bajo el módulo "productos" de la matriz de permisos: Ver
// para todos, Crear reservado a Dueño y Depósito (Cajero solo consulta el
// catálogo, no lo edita).
export async function GET() {
  const resultado = await requirePermiso("productos", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const categorias = await prisma.categoria.findMany({
    where: { ferreteriaId: resultado.contexto.ferreteriaId },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json({ categorias });
}

export async function POST(req: Request) {
  const resultado = await requirePermiso("productos", "crear");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const body = await req.json().catch(() => null);
  const parsed = crearCategoriaSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  const categoria = await prisma.categoria.create({
    data: { ferreteriaId: resultado.contexto.ferreteriaId, nombre: parsed.data.nombre },
  });
  return NextResponse.json({ categoria }, { status: 201 });
}
