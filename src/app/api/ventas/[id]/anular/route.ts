import { NextResponse } from "next/server";
import { requirePermiso } from "@/lib/tenant";
import { anularVenta } from "@/lib/ventas";
import { anularVentaSchema } from "@/lib/schemas-ventas";
import { manejarErrorNegocio } from "@/lib/errores-negocio";

// Anular es exclusivo de Dueño (matriz de permisos, sección 6 — decisión
// pendiente #3, cerrada).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const resultado = await requirePermiso("ventas", "anular");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const body = await req.json().catch(() => null);
  const parsed = anularVentaSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });

  try {
    await anularVenta(resultado.contexto.ferreteriaId, params.id, resultado.contexto.usuarioId, parsed.data.motivo);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return manejarErrorNegocio(error);
  }
}
