import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { modificarClienteSchema } from "@/lib/schemas-catalogo";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = modificarClienteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  const resultado = await requirePermiso("clientes", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });
  const { contexto } = resultado;

  // Activar/desactivar es la baja lógica ("eliminar" de la matriz) —
  // permiso distinto de editar nombre/teléfono ("modificar"), mismo
  // criterio que ya usan Categorías/Sub Categorías/Marcas/Productos.
  const { activo, ...resto } = parsed.data;
  if (activo !== undefined && !tienePermiso(contexto.rol, "clientes", "eliminar")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  if (Object.keys(resto).length > 0 && !tienePermiso(contexto.rol, "clientes", "modificar")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  // requirePermiso("clientes","ver") no bloquea soporte por sí solo (el
  // bloqueo genérico es solo para acciones != "ver") — como acá se permite
  // "ver" para poder ramificar el permiso por campo, hace falta este check
  // explícito para que Soporte (Super Admin impersonando) no pueda escribir.
  if (contexto.soporte) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  const data = {
    ...parsed.data,
    // "" (opción "Sin lista" del selector) -> null, para limpiar la FK en
    // vez de intentar guardar un id vacío que no matchea ninguna lista.
    ...(parsed.data.listaPrecioId !== undefined ? { listaPrecioId: parsed.data.listaPrecioId || null } : {}),
  };

  try {
    const cliente = await prisma.cliente.update({
      where: { id_ferreteriaId: { id: params.id, ferreteriaId: contexto.ferreteriaId } },
      data,
    });
    return NextResponse.json({ cliente });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Cliente no encontrado." }, { status: 404 });
    }
    throw error;
  }
}
