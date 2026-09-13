import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { modificarMarcaSchema } from "@/lib/schemas-catalogo";
import { manejarErrorPrisma } from "@/lib/prisma-errors";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = modificarMarcaSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  const resultado = await requirePermiso("productos", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });
  const { contexto } = resultado;

  const { activo, ...resto } = parsed.data;
  if (activo !== undefined && !tienePermiso(contexto.rol, "productos", "eliminar")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  if (Object.keys(resto).length > 0 && !tienePermiso(contexto.rol, "productos", "modificar")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  if (contexto.soporte) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  try {
    const marca = await prisma.marca.update({
      where: { id_ferreteriaId: { id: params.id, ferreteriaId: contexto.ferreteriaId } },
      data: parsed.data,
    });
    return NextResponse.json({ marca });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Marca no encontrada." }, { status: 404 });
    }
    return manejarErrorPrisma(error, "Ya existe una marca con ese nombre.");
  }
}
