import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { editarPagoPlataforma } from "@/lib/ferreterias";
import { editarPagoPlataformaSchema } from "@/lib/schemas-ferreterias";
import { manejarErrorNegocio } from "@/lib/errores-negocio";

export async function PATCH(req: Request, { params }: { params: { id: string; pagoId: string } }) {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = editarPagoPlataformaSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  try {
    await editarPagoPlataforma(
      params.id,
      params.pagoId,
      {
        fecha: new Date(parsed.data.fecha),
        monto: parsed.data.monto,
        esGratis: parsed.data.esGratis,
        vigenciaHasta: new Date(parsed.data.vigenciaHasta),
      },
      session.user.id,
    );
    return NextResponse.json({ ok: true });
  } catch (error) {
    return manejarErrorNegocio(error);
  }
}
