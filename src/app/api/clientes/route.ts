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

  try {
    const cliente = await prisma.cliente.create({
      data: {
        ferreteriaId: resultado.contexto.ferreteriaId,
        nombre: parsed.data.nombre,
        rut: parsed.data.rut || undefined,
        telefono: parsed.data.telefono,
        email: parsed.data.email || undefined,
        direccion: parsed.data.direccion,
        ciudad: parsed.data.ciudad,
        listaPrecioId: parsed.data.listaPrecioId || undefined,
      },
    });
    return NextResponse.json({ cliente }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Ya existe un cliente con ese RUT." }, { status: 409 });
    }
    throw error;
  }
}
