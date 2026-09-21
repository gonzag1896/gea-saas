import { NextResponse } from "next/server";
import { requirePermiso } from "@/lib/tenant";
import { listarUsuariosFerreteria, crearUsuario } from "@/lib/usuarios";
import { crearUsuarioSchema } from "@/lib/schemas-usuarios";
import { manejarErrorNegocio } from "@/lib/errores-negocio";

export async function GET() {
  const resultado = await requirePermiso("usuarios", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const usuarios = await listarUsuariosFerreteria(resultado.contexto.ferreteriaId);
  return NextResponse.json({ usuarios });
}

export async function POST(req: Request) {
  const resultado = await requirePermiso("usuarios", "crear");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });
  if (resultado.contexto.soporte) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = crearUsuarioSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });

  try {
    const membresia = await crearUsuario(resultado.contexto.ferreteriaId, parsed.data);
    return NextResponse.json({ membresia }, { status: 201 });
  } catch (error) {
    return manejarErrorNegocio(error);
  }
}
