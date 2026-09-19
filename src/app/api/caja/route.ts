import { NextResponse } from "next/server";
import { requirePermiso } from "@/lib/tenant";
import { registrarCierreCaja } from "@/lib/caja";
import { registrarCierreCajaSchema } from "@/lib/schemas-caja";
import { manejarErrorNegocio } from "@/lib/errores-negocio";

export async function POST(req: Request) {
  const resultado = await requirePermiso("caja", "crear");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const body = await req.json().catch(() => null);
  const parsed = registrarCierreCajaSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });

  try {
    const cierre = await registrarCierreCaja(
      resultado.contexto.ferreteriaId,
      resultado.contexto.usuarioId,
      new Date(parsed.data.fecha),
      parsed.data.totalContado,
      parsed.data.observaciones,
    );
    return NextResponse.json({ cierre }, { status: 201 });
  } catch (error) {
    return manejarErrorNegocio(error);
  }
}
