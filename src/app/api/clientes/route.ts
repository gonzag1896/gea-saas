import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";
import { crearClienteSchema } from "@/lib/schemas-catalogo";

export async function GET() {
  const resultado = await requirePermiso("clientes", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const clientes = await prisma.cliente.findMany({
    where: { ferreteriaId: resultado.contexto.ferreteriaId },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json({ clientes });
}

export async function POST(req: Request) {
  const resultado = await requirePermiso("clientes", "crear");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const body = await req.json().catch(() => null);
  const parsed = crearClienteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  // Cliente no tiene UNIQUE de negocio (igual que en el GeneXus original) —
  // no hace falta manejar P2002 acá.
  const cliente = await prisma.cliente.create({
    data: { ferreteriaId: resultado.contexto.ferreteriaId, nombre: parsed.data.nombre, telefono: parsed.data.telefono },
  });
  return NextResponse.json({ cliente }, { status: 201 });
}
