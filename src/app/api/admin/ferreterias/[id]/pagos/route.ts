import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { registrarPagoPlataforma, listarPagosPlataforma } from "@/lib/ferreterias";
import { registrarPagoPlataformaSchema } from "@/lib/schemas-ferreterias";
import { manejarErrorNegocio } from "@/lib/errores-negocio";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  const pagos = await listarPagosPlataforma(params.id);
  return NextResponse.json({ pagos });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = registrarPagoPlataformaSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  try {
    const pago = await registrarPagoPlataforma(
      params.id,
      {
        fecha: new Date(parsed.data.fecha),
        monto: parsed.data.monto,
        esGratis: parsed.data.esGratis,
        vigenciaHastaManual: parsed.data.vigenciaHastaManual ? new Date(parsed.data.vigenciaHastaManual) : undefined,
      },
      session.user.id,
    );
    return NextResponse.json({ pago });
  } catch (error) {
    return manejarErrorNegocio(error);
  }
}
