import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";
import { guardarPreciosListaSchema } from "@/lib/schemas-catalogo";

// Un precio por lista es "precios", no "productos" — mismo permiso
// (exclusivo de Dueño) que precioCosto/precioVenta, separado del resto
// del catálogo que Depósito también puede tocar.
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const resultado = await requirePermiso("precios", "modificar");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const body = await req.json().catch(() => null);
  const parsed = guardarPreciosListaSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Datos inválidos." }, { status: 400 });

  const { ferreteriaId } = resultado.contexto;
  const producto = await prisma.producto.findUnique({ where: { id_ferreteriaId: { id: params.id, ferreteriaId } } });
  if (!producto) return NextResponse.json({ error: "Producto no encontrado." }, { status: 404 });

  await prisma.$transaction(
    Object.entries(parsed.data.precios).map(([listaPrecioId, precio]) =>
      precio === null
        ? prisma.precioProducto.deleteMany({ where: { ferreteriaId, productoId: params.id, listaPrecioId } })
        : prisma.precioProducto.upsert({
            where: { ferreteriaId_listaPrecioId_productoId: { ferreteriaId, listaPrecioId, productoId: params.id } },
            create: { ferreteriaId, listaPrecioId, productoId: params.id, precio },
            update: { precio },
          }),
    ),
  );

  return NextResponse.json({ ok: true });
}
