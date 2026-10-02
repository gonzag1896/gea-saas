import { NextResponse } from "next/server";
import { requirePermiso } from "@/lib/tenant";
import { anularPagoProveedor } from "@/lib/cuenta-proveedor";
import { anularMovimientoSchema } from "@/lib/schemas-cuenta-corriente";
import { manejarErrorNegocio } from "@/lib/errores-negocio";

// `id` es el id del movimiento de cuenta corriente (el pago), no del proveedor.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const resultado = await requirePermiso("pagosProveedor", "anular");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const body = await req.json().catch(() => null);
  const parsed = anularMovimientoSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });

  try {
    await anularPagoProveedor(resultado.contexto.ferreteriaId, params.id, resultado.contexto.usuarioId, parsed.data.motivo);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return manejarErrorNegocio(error);
  }
}
