import { NextResponse } from "next/server";
import { requirePermiso } from "@/lib/tenant";
import { calcularEsperadoCaja } from "@/lib/caja";

// Preview en vivo del esperado para un rango de fechas elegido a mano en
// el formulario de cierre -- el Server Component de /caja solo trae el
// esperado de "hoy"; si el usuario cambia el rango (cierre de varios
// días), el form pide acá el recálculo sin recargar la página entera.
export async function GET(req: Request) {
  const resultado = await requirePermiso("caja", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const { searchParams } = new URL(req.url);
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta") || desde;
  if (!desde) return NextResponse.json({ error: "Falta la fecha 'desde'." }, { status: 400 });

  const esperado = await calcularEsperadoCaja(resultado.contexto.ferreteriaId, new Date(desde), new Date(hasta!));
  return NextResponse.json(esperado);
}
