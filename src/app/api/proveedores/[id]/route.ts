import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";
import { modificarProveedorSchema } from "@/lib/schemas-catalogo";
import { manejarErrorPrisma } from "@/lib/prisma-errors";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const resultado = await requirePermiso("proveedores", "modificar");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const body = await req.json().catch(() => null);
  const parsed = modificarProveedorSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  try {
    const proveedor = await prisma.proveedor.update({
      where: { id_ferreteriaId: { id: params.id, ferreteriaId: resultado.contexto.ferreteriaId } },
      data: { ...parsed.data, rut: parsed.data.rut || undefined, email: parsed.data.email || undefined },
    });
    return NextResponse.json({ proveedor });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Proveedor no encontrado." }, { status: 404 });
    }
    return manejarErrorPrisma(error, "Ya existe un proveedor con ese RUT.");
  }
}
