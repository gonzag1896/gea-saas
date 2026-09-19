import { NextResponse } from "next/server";
import { requirePermiso } from "@/lib/tenant";
import { obtenerCotizacionDolar, actualizarCotizacionDolar } from "@/lib/configuracion";
import { actualizarCotizacionSchema } from "@/lib/schemas-configuracion";

export async function GET() {
  const resultado = await requirePermiso("configuracion", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const cotizacion = await obtenerCotizacionDolar(resultado.contexto.ferreteriaId);
  return NextResponse.json(cotizacion);
}

export async function PATCH(req: Request) {
  const resultado = await requirePermiso("configuracion", "modificar");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const body = await req.json().catch(() => null);
  const parsed = actualizarCotizacionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });

  await actualizarCotizacionDolar(resultado.contexto.ferreteriaId, parsed.data.cotizacionDolar, resultado.contexto.usuarioId);
  return NextResponse.json({ ok: true });
}
