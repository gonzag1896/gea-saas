import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { crearCategoriaSchema } from "@/lib/schemas-catalogo";

// Primer endpoint real de negocio, a propósito acotado: existe para probar
// de punta a punta el patrón de aislamiento por tenant que el resto de
// Fase 6 (Maestros) va a repetir — no la funcionalidad completa de
// Categorías (sin editar/eliminar todavía).
export async function GET() {
  const contexto = await obtenerContextoTenant();
  if (!contexto) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const categorias = await prisma.categoria.findMany({
    where: { ferreteriaId: contexto.ferreteriaId },
    orderBy: { nombre: "asc" },
  });
  return NextResponse.json({ categorias });
}

export async function POST(req: Request) {
  const contexto = await obtenerContextoTenant();
  if (!contexto) return NextResponse.json({ error: "No autorizado." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const parsed = crearCategoriaSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  const categoria = await prisma.categoria.create({
    data: { ferreteriaId: contexto.ferreteriaId, nombre: parsed.data.nombre },
  });
  return NextResponse.json({ categoria }, { status: 201 });
}
