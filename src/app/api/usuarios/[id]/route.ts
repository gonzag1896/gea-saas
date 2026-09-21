import { NextResponse } from "next/server";
import { requirePermiso } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { cambiarRolUsuario, cambiarEstadoMembresia } from "@/lib/usuarios";
import { actualizarUsuarioSchema } from "@/lib/schemas-usuarios";
import { manejarErrorNegocio } from "@/lib/errores-negocio";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = actualizarUsuarioSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  const resultado = await requirePermiso("usuarios", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });
  const { contexto } = resultado;

  // Cambiar rol y desactivar/reactivar son permisos distintos de la
  // matriz ("modificar" y "eliminar" respectivamente) — mismo criterio
  // que ya usan Clientes/Proveedores/Productos para separar edición de
  // baja lógica.
  if (parsed.data.estado !== undefined && !tienePermiso(contexto.rol, "usuarios", "eliminar")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  if (parsed.data.rol !== undefined && !tienePermiso(contexto.rol, "usuarios", "modificar")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  if (contexto.soporte) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  try {
    if (parsed.data.rol !== undefined) {
      await cambiarRolUsuario(contexto.ferreteriaId, params.id, parsed.data.rol, contexto.usuarioId);
    }
    if (parsed.data.estado !== undefined) {
      await cambiarEstadoMembresia(contexto.ferreteriaId, params.id, parsed.data.estado, contexto.usuarioId);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return manejarErrorNegocio(error);
  }
}
