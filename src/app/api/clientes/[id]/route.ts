import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";
import { modificarClienteSchema } from "@/lib/schemas-catalogo";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const resultado = await requirePermiso("clientes", "modificar");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const body = await req.json().catch(() => null);
  const parsed = modificarClienteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  try {
    const cliente = await prisma.cliente.update({
      where: { id_ferreteriaId: { id: params.id, ferreteriaId: resultado.contexto.ferreteriaId } },
      data: parsed.data,
    });
    return NextResponse.json({ cliente });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    }
    throw error;
  }
}
