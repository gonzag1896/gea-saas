import { NextResponse } from "next/server";
import { requirePermiso } from "@/lib/tenant";
import { registrarAjusteStock } from "@/lib/stock";
import { ajusteStockSchema } from "@/lib/schemas-stock";
import { manejarErrorNegocio } from "@/lib/errores-negocio";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const resultado = await requirePermiso("ajustesStock", "crear");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const body = await req.json().catch(() => null);
  const parsed = ajusteStockSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });

  try {
    await registrarAjusteStock(
      resultado.contexto.ferreteriaId,
      params.id,
      parsed.data.tipo,
      parsed.data.cantidad,
      parsed.data.motivo,
      resultado.contexto.usuarioId,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return manejarErrorNegocio(error);
  }
}
