import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";
import { crearProveedorSchema } from "@/lib/schemas-catalogo";
import { manejarErrorPrisma } from "@/lib/prisma-errors";

export async function GET() {
  const resultado = await requirePermiso("proveedores", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const proveedores = await prisma.proveedor.findMany({
    where: { ferreteriaId: resultado.contexto.ferreteriaId },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json({ proveedores });
}

export async function POST(req: Request) {
  const resultado = await requirePermiso("proveedores", "crear");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const body = await req.json().catch(() => null);
  const parsed = crearProveedorSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  try {
    const proveedor = await prisma.proveedor.create({
      data: {
        ferreteriaId: resultado.contexto.ferreteriaId,
        nombre: parsed.data.nombre,
        rut: parsed.data.rut || undefined,
        telefono: parsed.data.telefono,
        email: parsed.data.email || undefined,
      },
    });
    return NextResponse.json({ proveedor }, { status: 201 });
  } catch (error) {
    return manejarErrorPrisma(error, "Ya existe un proveedor con ese RUT.");
  }
}
