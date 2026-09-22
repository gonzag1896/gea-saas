import { NextResponse } from "next/server";
import { requirePermiso } from "@/lib/tenant";
import { actualizarCierreCaja } from "@/lib/caja";
import { actualizarCierreCajaSchema } from "@/lib/schemas-caja";
import { manejarErrorNegocio } from "@/lib/errores-negocio";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const resultado = await requirePermiso("caja", "modificar");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });
  if (resultado.contexto.soporte) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = actualizarCierreCajaSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });

  try {
    const cierre = await actualizarCierreCaja(resultado.contexto.ferreteriaId, params.id, resultado.contexto.usuarioId, parsed.data);
    return NextResponse.json({ cierre });
  } catch (error) {
    return manejarErrorNegocio(error);
  }
}
