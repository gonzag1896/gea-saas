import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const resultado = await requirePermiso("stock", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const producto = await prisma.producto.findUnique({
    where: { id_ferreteriaId: { id: params.id, ferreteriaId: resultado.contexto.ferreteriaId } },
  });
  if (!producto) return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });

  const movimientos = await prisma.movimientoStock.findMany({
    where: { productoId: params.id, ferreteriaId: resultado.contexto.ferreteriaId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ producto, movimientos });
}
