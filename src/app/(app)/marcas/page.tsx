import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { MarcasClient } from "./MarcasClient";

export default async function MarcasPage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");

  const marcas = await prisma.marca.findMany({
    where: { ferreteriaId: contexto.ferreteriaId },
    orderBy: { nombre: "asc" },
  });

  return (
    <MarcasClient
      marcasIniciales={marcas}
      puedeCrear={tienePermiso(contexto.rol, "productos", "crear")}
      puedeEditar={tienePermiso(contexto.rol, "productos", "modificar")}
      puedeEliminar={tienePermiso(contexto.rol, "productos", "eliminar")}
    />
  );
}
