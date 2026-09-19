import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { modificarProductoGeneralSchema, modificarProductoPrecioSchema } from "@/lib/schemas-catalogo";
import { manejarErrorPrisma } from "@/lib/prisma-errors";
import { auditar } from "@/lib/auditoria";

// Un solo PATCH, pero hasta tres permisos posibles: cambiar precioCosto/
// precioVenta exige el módulo "precios" (exclusivo de Dueño); activar o
// desactivar es la baja lógica ("eliminar" de la matriz, también exclusivo
// de Dueño); el resto de los campos exige "productos:modificar" (Dueño y
// Depósito). Separados así nadie cuela un cambio de precio o una baja
// disfrazados de una edición de descripción.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  const { precioCosto, precioVenta, activo, ...resto } = body as Record<string, unknown>;
  const tieneCambioPrecio = precioCosto !== undefined || precioVenta !== undefined;
  const tieneCambioActivo = activo !== undefined;
  const tieneCambioGeneral = Object.keys(resto).length > 0;
  if (!tieneCambioPrecio && !tieneCambioActivo && !tieneCambioGeneral) {
    return NextResponse.json({ error: "No hay nada para modificar." }, { status: 400 });
  }

  const parsedGeneral = tieneCambioGeneral ? modificarProductoGeneralSchema.omit({ activo: true }).safeParse(resto) : null;
  const parsedPrecio = tieneCambioPrecio ? modificarProductoPrecioSchema.safeParse({ precioCosto, precioVenta }) : null;
  if (parsedGeneral && !parsedGeneral.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  if (parsedPrecio && !parsedPrecio.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });
  if (tieneCambioActivo && typeof activo !== "boolean") return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  const resultado = await requirePermiso("productos", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });
  const { contexto } = resultado;

  if (tieneCambioGeneral && !tienePermiso(contexto.rol, "productos", "modificar")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  if (tieneCambioActivo && !tienePermiso(contexto.rol, "productos", "eliminar")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  if (tieneCambioPrecio && !tienePermiso(contexto.rol, "precios", "modificar")) {
    return NextResponse.json({ error: "No autorizado." }, { status: 403 });
  }
  if (contexto.soporte) return NextResponse.json({ error: "No autorizado." }, { status: 403 });

  const { ferreteriaId } = contexto;
  const dataComun = {
    ...(parsedGeneral?.data ?? {}),
    // Mismo criterio que en el alta: "" se guarda como NULL, no como
    // string vacío, para no chocar contra el UNIQUE si dos productos
    // limpian el código de barras.
    ...(parsedGeneral?.data.codigoBarras !== undefined ? { codigoBarras: parsedGeneral.data.codigoBarras || null } : {}),
    ...(tieneCambioActivo ? { activo: activo as boolean } : {}),
  };

  try {
    if (tieneCambioPrecio) {
      const anterior = await prisma.producto.findUniqueOrThrow({
        where: { id_ferreteriaId: { id: params.id, ferreteriaId } },
        select: { precioCosto: true, precioVenta: true },
      });
      const producto = await prisma.producto.update({
        where: { id_ferreteriaId: { id: params.id, ferreteriaId } },
        data: { ...dataComun, ...(parsedPrecio?.data ?? {}), fechaUltActualizacionPrecio: new Date() },
      });
      await auditar({
        accion: "PRODUCTO_PRECIO_CAMBIO",
        usuarioId: contexto.usuarioId,
        ferreteriaId,
        entidad: "Producto",
        entidadId: params.id,
        detalle: {
          precioCostoAnterior: anterior.precioCosto.toString(),
          precioCostoNuevo: producto.precioCosto.toString(),
          precioVentaAnterior: anterior.precioVenta.toString(),
          precioVentaNuevo: producto.precioVenta.toString(),
        },
      });
      return NextResponse.json({ producto });
    }

    const producto = await prisma.producto.update({
      where: { id_ferreteriaId: { id: params.id, ferreteriaId } },
      data: dataComun,
    });
    return NextResponse.json({ producto });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2025") {
      return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });
    }
    return manejarErrorPrisma(error, (target) =>
      target.includes("codigoBarras") ? "Ya existe un producto con ese código de barras." : "Ya existe un producto con ese código.");
  }
}
