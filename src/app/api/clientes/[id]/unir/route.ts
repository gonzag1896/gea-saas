import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermiso } from "@/lib/tenant";
import { unirClientes, vistaPreviaUnionClientes } from "@/lib/clientes";
import { manejarErrorNegocio } from "@/lib/errores-negocio";

// `id` es el cliente DUPLICADO (el que se elimina); `destinoId` es el que se
// conserva. Solo el Dueño (mismo permiso que eliminar un cliente): el
// duplicado desaparece y la unión no se puede deshacer.
const unirSchema = z.object({ destinoId: z.string().min(1, "Elegí el cliente a conservar.") });

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const resultado = await requirePermiso("clientes", "eliminar");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const parsed = unirSchema.safeParse({ destinoId: new URL(req.url).searchParams.get("destinoId") ?? "" });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });

  try {
    return NextResponse.json(await vistaPreviaUnionClientes(resultado.contexto.ferreteriaId, params.id, parsed.data.destinoId));
  } catch (error) {
    return manejarErrorNegocio(error);
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const resultado = await requirePermiso("clientes", "eliminar");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const parsed = unirSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });

  try {
    const union = await unirClientes(resultado.contexto.ferreteriaId, params.id, parsed.data.destinoId, resultado.contexto.usuarioId);
    return NextResponse.json({ ok: true, ...union });
  } catch (error) {
    return manejarErrorNegocio(error);
  }
}
