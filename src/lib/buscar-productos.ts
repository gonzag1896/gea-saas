import type { Prisma } from "@prisma/client";

export const COLUMNAS_ORDENABLES = ["codigo", "descripcion", "familia", "marca", "costo", "venta", "stock", "estado"] as const;
export type ColumnaOrden = (typeof COLUMNAS_ORDENABLES)[number];

// Búsqueda por texto parcial, palabra por palabra: "tornillo 6mm" exige
// que CADA palabra aparezca en alguno de los campos (en cualquier orden).
// Usa ILIKE, que aprovecha los índices trigram de Producto (ver migración
// busqueda_productos_trigram).
export function condicionBusquedaProductos(texto: string, amplia = false): Prisma.ProductoWhereInput {
  const palabras = texto.trim().split(/\s+/).filter(Boolean).slice(0, 6);
  if (palabras.length === 0) return {};

  return {
    AND: palabras.map((palabra) => ({
      OR: [
        { codigo: { contains: palabra, mode: "insensitive" as const } },
        { descripcion: { contains: palabra, mode: "insensitive" as const } },
        { codigoBarras: { contains: palabra, mode: "insensitive" as const } },
        ...(amplia
          ? [
              { marca: { nombre: { contains: palabra, mode: "insensitive" as const } } },
              { subCategoria: { nombre: { contains: palabra, mode: "insensitive" as const } } },
              { subCategoria: { categoria: { nombre: { contains: palabra, mode: "insensitive" as const } } } },
            ]
          : []),
      ],
    })),
  };
}
