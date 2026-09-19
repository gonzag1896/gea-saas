import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";
import { registrarCobro } from "@/lib/cuenta-corriente";
import { registrarCobroSchema } from "@/lib/schemas-cuenta-corriente";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const resultado = await requirePermiso("cobros", "crear");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const body = await req.json().catch(() => null);
  const parsed = registrarCobroSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });

  const { ferreteriaId, usuarioId } = resultado.contexto;
  const cliente = await prisma.cliente.findUnique({ where: { id_ferreteriaId: { id: params.id, ferreteriaId } } });
  if (!cliente) return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });

  await registrarCobro(ferreteriaId, params.id, parsed.data.monto, usuarioId, parsed.data.referencia, parsed.data.medioPago);
  return NextResponse.json({ ok: true }, { status: 201 });
}
