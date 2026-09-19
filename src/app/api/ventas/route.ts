import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";
import { crearVentaSchema } from "@/lib/schemas-ventas";
import { crearVentaConfirmada } from "@/lib/ventas";
import { manejarErrorNegocio } from "@/lib/errores-negocio";

export async function GET() {
  const resultado = await requirePermiso("ventas", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const ventas = await prisma.venta.findMany({
    where: { ferreteriaId: resultado.contexto.ferreteriaId },
    include: { cliente: { select: { nombre: true } }, detalle: true },
    orderBy: { fecha: "desc" },
  });
  return NextResponse.json({ ventas });
}

// La venta se crea directamente CONFIRMADO — sin paso intermedio de
// Pendiente — para que cargarla sea un solo trámite, no dos. Ver
// crearVentaConfirmada() en @/lib/ventas para el detalle de la
// transacción (stock + cuenta corriente incluidos).
export async function POST(req: Request) {
  const resultado = await requirePermiso("ventas", "crear");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const body = await req.json().catch(() => null);
  const parsed = crearVentaSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });

  try {
    const venta = await crearVentaConfirmada(resultado.contexto.ferreteriaId, resultado.contexto.usuarioId, parsed.data);
    return NextResponse.json({ venta }, { status: 201 });
  } catch (error) {
    return manejarErrorNegocio(error);
  }
}
