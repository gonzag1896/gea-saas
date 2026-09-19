import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { ListaPrecioDetalleClient } from "./ListaPrecioDetalleClient";

export default async function ListaPrecioDetallePage({ params }: { params: { id: string } }) {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");
  if (!tienePermiso(contexto.rol, "listasPrecio", "ver")) redirect("/dashboard");

  const { ferreteriaId } = contexto;
  const lista = await prisma.listaPrecio.findUnique({ where: { id_ferreteriaId: { id: params.id, ferreteriaId } } });
  if (!lista) notFound();

  const precios = await prisma.precioProducto.findMany({
    where: { ferreteriaId, listaPrecioId: params.id },
    select: {
      id: true,
      precio: true,
      producto: {
        select: { codigo: true, descripcion: true, activo: true, subCategoria: { select: { nombre: true, categoria: { select: { nombre: true } } } } },
      },
    },
    orderBy: { producto: { descripcion: "asc" } },
  });

  const filas = precios
    .filter((p) => p.producto.activo)
    .map((p) => ({
      id: p.id,
      codigo: p.producto.codigo,
      producto: p.producto.descripcion,
      familia: p.producto.subCategoria.nombre,
      categoria: p.producto.subCategoria.categoria.nombre,
      precio: p.precio.toString(),
    }));

  return <ListaPrecioDetalleClient lista={lista} filas={filas} />;
}
