import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

// Todas las UNIQUE de los Maestros (Categoria.nombre, SubCategoria.nombre,
// Marca.nombre, Producto.codigo, Proveedor.rut) son por ferretería — cuando
// Postgres las rechaza (P2002), la respuesta debe ser un 409 legible, no un
// 500 con el nombre de la constraint de Postgres filtrado al cliente.
export function manejarErrorPrisma(
  error: unknown,
  mensajeDuplicado: string | ((target: string[]) => string),
): NextResponse {
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
    const target = (error.meta?.target as string[] | undefined) ?? [];
    const mensaje = typeof mensajeDuplicado === "function" ? mensajeDuplicado(target) : mensajeDuplicado;
    return NextResponse.json({ error: mensaje }, { status: 409 });
  }
  throw error;
}
