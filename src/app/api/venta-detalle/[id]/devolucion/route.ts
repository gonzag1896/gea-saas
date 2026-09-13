import { NextResponse } from "next/server";
import { requirePermiso } from "@/lib/tenant";
import { registrarDevolucionVenta } from "@/lib/ventas";
import { devolucionVentaSchema } from "@/lib/schemas-ventas";
import { manejarErrorNegocio } from "@/lib/errores-negocio";

// Gateada como "ventas:modificar" (Dueño y Cajero): procesar la devolución
// de un cliente en el mostrador es tarea de quien atiende ventas, igual
// que confirmar una venta.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const resultado = await requirePermiso("ventas", "modificar");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const body = await req.json().catch(() => null);
  const parsed = devolucionVentaSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });

  try {
    const devolucion = await registrarDevolucionVenta(
      resultado.contexto.ferreteriaId,
      params.id,
      parsed.data.cantidad,
      parsed.data.motivo,
      resultado.contexto.usuarioId,
    );
    return NextResponse.json({ devolucion }, { status: 201 });
  } catch (error) {
    return manejarErrorNegocio(error);
  }
}
