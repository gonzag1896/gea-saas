import { NextResponse } from "next/server";
import { requirePermiso } from "@/lib/tenant";
import { consultarCotizacionDolarBcu, ErrorConsultaBcu } from "@/lib/bcu";

// Solo consulta y devuelve el valor — no lo guarda. Guardar es un paso
// aparte (PATCH /api/configuracion) que el Dueño confirma a mano.
export async function GET() {
  const resultado = await requirePermiso("configuracion", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  try {
    const cotizacion = await consultarCotizacionDolarBcu();
    return NextResponse.json(cotizacion);
  } catch (error) {
    if (error instanceof ErrorConsultaBcu) return NextResponse.json({ error: error.message }, { status: 502 });
    throw error;
  }
}
