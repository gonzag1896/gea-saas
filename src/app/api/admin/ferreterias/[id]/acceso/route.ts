import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { cambiarAccesoFerreteria } from "@/lib/ferreterias";
import { manejarErrorNegocio } from "@/lib/errores-negocio";

const schema = z.object({ habilitado: z.boolean() });

// Inhabilita (habilitado: false) o vuelve a habilitar el acceso de una
// ferretería. Solo el Super Admin de la plataforma.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  try {
    const resultado = await cambiarAccesoFerreteria(params.id, parsed.data.habilitado, session.user.id);
    return NextResponse.json({ ok: true, ...resultado });
  } catch (error) {
    return manejarErrorNegocio(error);
  }
}
