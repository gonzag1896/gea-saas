import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { VentasClient } from "./VentasClient";

export default async function VentasPage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");

  const { ferreteriaId } = contexto;
  const [ventasRaw, clientes, productos] = await Promise.all([
    prisma.venta.findMany({
      where: { ferreteriaId },
      select: { id: true, fecha: true, estado: true, medioPago: true, total: true, cliente: { select: { nombre: true } } },
      orderBy: { fecha: "desc" },
    }),
    prisma.cliente.findMany({ where: { ferreteriaId }, select: { id: true, nombre: true } }),
    prisma.producto.findMany({ where: { ferreteriaId }, select: { id: true, codigo: true, descripcion: true } }),
  ]);

  const ventas = ventasRaw.map((v) => ({ ...v, total: v.total.toString() }));
  const puedeCrear = tienePermiso(contexto.rol, "ventas", "crear");

  return <VentasClient ventasIniciales={ventas} clientes={clientes} productos={productos} puedeCrear={puedeCrear} />;
}
