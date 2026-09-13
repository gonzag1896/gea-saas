import { NextResponse } from "next/server";
import { requirePermiso } from "@/lib/tenant";
import { registrarDevolucionCompra } from "@/lib/compras";
import { devolucionCompraSchema } from "@/lib/schemas-compras";
import { manejarErrorNegocio } from "@/lib/errores-negocio";

// Gateada como "compras:modificar" (Dueño y Depósito): devolver mercadería
// a un proveedor es una tarea operativa de quien recibe/despacha
// mercadería, no una anulación — la matriz no define un módulo aparte
// para devoluciones, y este es el que más se le parece en quién opera.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const resultado = await requirePermiso("compras", "modificar");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const body = await req.json().catch(() => null);
  const parsed = devolucionCompraSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });

  try {
    const devolucion = await registrarDevolucionCompra(
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
