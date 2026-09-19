import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { ComprasClient } from "./ComprasClient";

export default async function ComprasPage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");

  const { ferreteriaId } = contexto;
  const comprasRaw = await prisma.compra.findMany({
    where: { ferreteriaId },
    select: { id: true, fecha: true, estado: true, total: true, proveedor: { select: { nombre: true } } },
    orderBy: { fecha: "desc" },
  });

  const compras = comprasRaw.map((c) => ({ ...c, total: c.total.toString() }));

  return (
    <ComprasClient
      comprasIniciales={compras}
      puedeCrear={tienePermiso(contexto.rol, "compras", "crear")}
      puedeAnular={tienePermiso(contexto.rol, "compras", "anular")}
    />
  );
}
