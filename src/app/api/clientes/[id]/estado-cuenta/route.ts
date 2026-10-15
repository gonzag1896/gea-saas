import { NextResponse } from "next/server";
import { requirePermiso } from "@/lib/tenant";
import { generarEstadoCuentaDeEntidad, periodoDesdeParams } from "@/lib/estado-cuenta-servidor";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const resultado = await requirePermiso("cuentaCorriente", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const periodo = periodoDesdeParams(new URL(req.url).searchParams);
  const pdf = await generarEstadoCuentaDeEntidad("cliente", resultado.contexto.ferreteriaId, params.id, periodo);
  if (!pdf) return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });

  return new NextResponse(new Uint8Array(pdf.buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${pdf.archivo}"` },
  });
}
