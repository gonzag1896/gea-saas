import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";
import { crearVentaSchema } from "@/lib/schemas-ventas";

export async function GET() {
  const resultado = await requirePermiso("ventas", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const ventas = await prisma.venta.findMany({
    where: { ferreteriaId: resultado.contexto.ferreteriaId },
    include: { cliente: { select: { nombre: true } }, detalle: true },
    orderBy: { fecha: "desc" },
  });
  return NextResponse.json({ ventas });
}

export async function POST(req: Request) {
  const resultado = await requirePermiso("ventas", "crear");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const body = await req.json().catch(() => null);
  const parsed = crearVentaSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });

  const { ferreteriaId, usuarioId } = resultado.contexto;
  const { detalle, ...datos } = parsed.data;

  const lineas = detalle.map((l) => ({ ...l, total: l.precio * l.cantidad - l.descuento }));
  const subtotal = lineas.reduce((acc, l) => acc + l.total, 0);
  const iva = datos.tipoIva === "TOTAL" ? subtotal * 0.22 : 0;

  const venta = await prisma.venta.create({
    data: {
      ferreteriaId,
      clienteId: datos.clienteId,
      fecha: new Date(datos.fecha),
      tipoIva: datos.tipoIva,
      medioPago: datos.medioPago,
      entrega: datos.entrega,
      registradoPorUsuarioId: usuarioId,
      subtotal,
      iva,
      total: subtotal + iva,
      // ferreteriaId no se repite en cada línea: Prisma lo autocompleta a
      // partir del padre al anidar bajo la relación "venta" (FK compuesta
      // ventaId+ferreteriaId) — ver mismo criterio en api/compras/route.ts.
      detalle: {
        create: lineas.map((l) => ({
          productoId: l.productoId,
          cantidad: l.cantidad,
          precio: l.precio,
          descuento: l.descuento,
          total: l.total,
          totalVigente: l.total,
        })),
      },
    },
    include: { detalle: true },
  });

  return NextResponse.json({ venta }, { status: 201 });
}
