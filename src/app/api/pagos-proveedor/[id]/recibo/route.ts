import { NextResponse } from "next/server";
import { requirePermiso } from "@/lib/tenant";
import { generarReciboDeMovimiento } from "@/lib/recibo-servidor";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const resultado = await requirePermiso("cuentaProveedores", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const pdf = await generarReciboDeMovimiento("proveedor", resultado.contexto.ferreteriaId, params.id);
  if (!pdf) return NextResponse.json({ error: "Pago no encontrado." }, { status: 404 });

  return new NextResponse(new Uint8Array(pdf.buffer), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${pdf.archivo}"` },
  });
}
