import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { crearFerreteria } from "@/lib/ferreterias";
import { crearFerreteriaSchema } from "@/lib/schemas-ferreterias";
import { manejarErrorNegocio } from "@/lib/errores-negocio";

// Administración de tenants: fuera de la matriz de permisos por-ferretería
// (src/lib/permisos.ts) a propósito — la puerta acá es "sos Super Admin",
// no un rol dentro de una ferretería. Por eso no pasa por requirePermiso().
export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.isSuperAdmin) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = crearFerreteriaSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  try {
    const ferreteria = await crearFerreteria(parsed.data, session.user.id);
    return NextResponse.json({ ferreteria });
  } catch (error) {
    return manejarErrorNegocio(error);
  }
}
