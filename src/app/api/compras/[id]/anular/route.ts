import { NextResponse } from "next/server";
import { requirePermiso } from "@/lib/tenant";
import { anularCompra } from "@/lib/compras";
import { anularCompraSchema } from "@/lib/schemas-compras";
import { manejarErrorNegocio } from "@/lib/errores-negocio";

// Anular es exclusivo de Dueño (matriz de permisos, sección 6) — a
// diferencia de crear/confirmar, que Depósito también hace.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const resultado = await requirePermiso("compras", "anular");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const body = await req.json().catch(() => null);
  const parsed = anularCompraSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });

  try {
    await anularCompra(resultado.contexto.ferreteriaId, params.id, resultado.contexto.usuarioId, parsed.data.motivo);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return manejarErrorNegocio(error);
  }
}
