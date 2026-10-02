import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";
import { registrarPagoProveedor } from "@/lib/cuenta-proveedor";
import { registrarCobroSchema } from "@/lib/schemas-cuenta-corriente";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const resultado = await requirePermiso("pagosProveedor", "crear");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const body = await req.json().catch(() => null);
  const parsed = registrarCobroSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });

  const { ferreteriaId, usuarioId } = resultado.contexto;
  const proveedor = await prisma.proveedor.findUnique({ where: { id_ferreteriaId: { id: params.id, ferreteriaId } } });
  if (!proveedor) return NextResponse.json({ error: "Proveedor no encontrado." }, { status: 404 });

  const { monto, referencia, medioPago, moneda, monedaRecibida, cotizacion } = parsed.data;
  const cruce = monedaRecibida && cotizacion ? { monedaRecibida, cotizacion } : undefined;
  await registrarPagoProveedor(ferreteriaId, params.id, monto, usuarioId, referencia, medioPago, moneda, cruce);
  return NextResponse.json({ ok: true }, { status: 201 });
}
