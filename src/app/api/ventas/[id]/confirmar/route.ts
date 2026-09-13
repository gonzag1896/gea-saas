import { NextResponse } from "next/server";
import { requirePermiso } from "@/lib/tenant";
import { confirmarVenta } from "@/lib/ventas";
import { manejarErrorNegocio } from "@/lib/errores-negocio";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const resultado = await requirePermiso("ventas", "modificar");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  try {
    await confirmarVenta(resultado.contexto.ferreteriaId, params.id, resultado.contexto.usuarioId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return manejarErrorNegocio(error);
  }
}
