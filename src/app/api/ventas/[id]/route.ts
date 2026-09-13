import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const resultado = await requirePermiso("ventas", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const venta = await prisma.venta.findUnique({
    where: { id_ferreteriaId: { id: params.id, ferreteriaId: resultado.contexto.ferreteriaId } },
    include: {
      cliente: true,
      detalle: { include: { producto: { select: { codigo: true, descripcion: true } }, devoluciones: true } },
    },
  });
  if (!venta) return NextResponse.json({ error: "Venta no encontrada." }, { status: 404 });

  return NextResponse.json({ venta });
}
