import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";
import { crearCompraSchema } from "@/lib/schemas-compras";
import { crearCompraConfirmada } from "@/lib/compras";
import { manejarErrorNegocio } from "@/lib/errores-negocio";

export async function GET() {
  const resultado = await requirePermiso("compras", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const compras = await prisma.compra.findMany({
    where: { ferreteriaId: resultado.contexto.ferreteriaId },
    include: { proveedor: { select: { nombre: true } }, detalle: true },
    orderBy: { fecha: "desc" },
  });
  return NextResponse.json({ compras });
}

// La compra se crea directamente CONFIRMADA — sin paso intermedio de
// Pendiente — para que cargarla sea un solo trámite, no dos. Ver
// crearCompraConfirmada() en @/lib/compras para el detalle de la
// transacción (stock + costo del producto incluidos).
export async function POST(req: Request) {
  const resultado = await requirePermiso("compras", "crear");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const body = await req.json().catch(() => null);
  const parsed = crearCompraSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });

  try {
    const compra = await crearCompraConfirmada(resultado.contexto.ferreteriaId, resultado.contexto.usuarioId, parsed.data);
    return NextResponse.json({ compra }, { status: 201 });
  } catch (error) {
    return manejarErrorNegocio(error);
  }
}
