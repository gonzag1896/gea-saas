import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";
import { crearCompraSchema } from "@/lib/schemas-compras";

export async function GET() {
  const resultado = await requirePermiso("compras", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const compras = await prisma.compra.findMany({
    where: { ferreteriaId: resultado.contexto.ferreteriaId },
    include: { proveedor: { select: { nombre: true } }, detalle: true },
    orderBy: { fecha: "desc" },
  });
  return NextResponse.json({ compras });
}

export async function POST(req: Request) {
  const resultado = await requirePermiso("compras", "crear");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const body = await req.json().catch(() => null);
  const parsed = crearCompraSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });

  const { ferreteriaId, usuarioId } = resultado.contexto;
  const { detalle, ...datos } = parsed.data;

  const subtotal = detalle.reduce((acc, l) => acc + l.cantidad * l.costoUnitario, 0);
  const iva = detalle.reduce((acc, l) => acc + (l.tipoIva === "TOTAL" ? l.cantidad * l.costoUnitario * 0.22 : 0), 0);

  const compra = await prisma.compra.create({
    data: {
      ferreteriaId,
      proveedorId: datos.proveedorId,
      fecha: new Date(datos.fecha),
      numeroFactura: datos.numeroFactura || undefined,
      facturaPdfUrl: datos.facturaPdfUrl || undefined,
      observaciones: datos.observaciones,
      registradoPorUsuarioId: usuarioId,
      subtotal,
      iva,
      total: subtotal + iva,
      // ferreteriaId no se repite en cada línea: al anidar el create bajo
      // la relación "compra" (FK compuesta compraId+ferreteriaId), Prisma
      // lo toma del padre solo — pasarlo acá de nuevo es un error de tipos,
      // no una redundancia inofensiva.
      detalle: {
        create: detalle.map((l) => ({
          productoId: l.productoId,
          cantidad: l.cantidad,
          costoUnitario: l.costoUnitario,
          tipoIva: l.tipoIva,
          subtotal: l.cantidad * l.costoUnitario,
        })),
      },
    },
    include: { detalle: true },
  });

  return NextResponse.json({ compra }, { status: 201 });
}
