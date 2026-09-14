import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { ComprasClient } from "./ComprasClient";

export default async function ComprasPage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");

  const { ferreteriaId } = contexto;
  const [comprasRaw, proveedores, productos] = await Promise.all([
    prisma.compra.findMany({
      where: { ferreteriaId },
      select: { id: true, fecha: true, estado: true, total: true, proveedor: { select: { nombre: true } } },
      orderBy: { fecha: "desc" },
    }),
    prisma.proveedor.findMany({ where: { ferreteriaId }, select: { id: true, nombre: true } }),
    prisma.producto.findMany({ where: { ferreteriaId }, select: { id: true, codigo: true, descripcion: true } }),
  ]);

  const compras = comprasRaw.map((c) => ({ ...c, total: c.total.toString() }));
  const puedeCrear = tienePermiso(contexto.rol, "compras", "crear");

  return <ComprasClient comprasIniciales={compras} proveedores={proveedores} productos={productos} puedeCrear={puedeCrear} />;
}
