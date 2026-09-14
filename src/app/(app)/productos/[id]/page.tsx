import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { ProductoMovimientosClient } from "./ProductoMovimientosClient";

export default async function ProductoMovimientosPage({ params }: { params: { id: string } }) {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");

  const [producto, movimientos] = await Promise.all([
    prisma.producto.findUnique({
      where: { id_ferreteriaId: { id: params.id, ferreteriaId: contexto.ferreteriaId } },
      select: { id: true, codigo: true, descripcion: true, stockActual: true, stockMinimo: true },
    }),
    prisma.movimientoStock.findMany({
      where: { productoId: params.id, ferreteriaId: contexto.ferreteriaId },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!producto) notFound();

  const puedeAjustar = tienePermiso(contexto.rol, "ajustesStock", "crear");

  return <ProductoMovimientosClient producto={producto} movimientosIniciales={movimientos} puedeAjustar={puedeAjustar} />;
}
