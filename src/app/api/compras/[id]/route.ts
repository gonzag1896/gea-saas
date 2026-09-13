import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const resultado = await requirePermiso("compras", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const compra = await prisma.compra.findUnique({
    where: { id_ferreteriaId: { id: params.id, ferreteriaId: resultado.contexto.ferreteriaId } },
    include: {
      proveedor: true,
      detalle: { include: { producto: { select: { codigo: true, descripcion: true } }, devoluciones: true } },
    },
  });
  if (!compra) return NextResponse.json({ error: "Compra no encontrada." }, { status: 404 });

  return NextResponse.json({ compra });
}
