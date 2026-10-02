import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { VentasClient } from "./VentasClient";

export default async function VentasPage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");

  const { ferreteriaId } = contexto;
  const ventasRaw = await prisma.venta.findMany({
    where: { ferreteriaId },
    select: { id: true, fecha: true, estado: true, medioPago: true, totalUYU: true, totalUSD: true, cliente: { select: { nombre: true } } },
    orderBy: { fecha: "desc" },
  });

  const ventas = ventasRaw.map((v) => ({ ...v, totalUYU: v.totalUYU.toString(), totalUSD: v.totalUSD.toString() }));

  return (
    <VentasClient
      ventasIniciales={ventas}
      puedeCrear={tienePermiso(contexto.rol, "ventas", "crear")}
      puedeAnular={tienePermiso(contexto.rol, "ventas", "anular")}
    />
  );
}
