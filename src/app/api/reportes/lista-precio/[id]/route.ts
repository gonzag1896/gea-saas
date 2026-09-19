import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requirePermiso } from "@/lib/tenant";
import { generarListaPreciosPdf, nombreArchivo, type ColumnaReporte } from "@/lib/reportes";

type FilaPrecio = {
  codigo: string;
  producto: string;
  familia: string;
  precio: number;
};

const COLUMNAS: ColumnaReporte<FilaPrecio>[] = [
  { header: "Código", value: (f) => f.codigo, anchoPdf: 80 },
  { header: "Producto", value: (f) => f.producto, anchoPdf: 220 },
  { header: "Familia", value: (f) => f.familia, anchoPdf: 120 },
  { header: "Precio", value: (f) => f.precio.toFixed(2), anchoPdf: 90, alineacion: "right" },
];

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const resultado = await requirePermiso("listasPrecio", "ver");
  if (!resultado.ok) return NextResponse.json({ error: "No autorizado." }, { status: resultado.status });

  const { ferreteriaId, ferreteriaNombre } = resultado.contexto;
  const lista = await prisma.listaPrecio.findUnique({ where: { id_ferreteriaId: { id: params.id, ferreteriaId } } });
  if (!lista) return NextResponse.json({ error: "Lista de precio no encontrada." }, { status: 404 });

  const precios = await prisma.precioProducto.findMany({
    where: { ferreteriaId, listaPrecioId: params.id },
    select: {
      precio: true,
      producto: { select: { codigo: true, descripcion: true, activo: true, subCategoria: { select: { nombre: true, categoria: { select: { nombre: true } } } } } },
    },
    orderBy: { producto: { descripcion: "asc" } },
  });

  const filas: FilaPrecio[] = precios
    .filter((p) => p.producto.activo)
    .map((p) => ({
      codigo: p.producto.codigo,
      producto: p.producto.descripcion,
      familia: `${p.producto.subCategoria.nombre} / ${p.producto.subCategoria.categoria.nombre}`,
      precio: Number(p.precio),
    }));

  const buffer = await generarListaPreciosPdf(ferreteriaNombre, lista.nombre, COLUMNAS, filas);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nombreArchivo(`lista-precio-${lista.nombre}`, "pdf")}"`,
    },
  });
}
