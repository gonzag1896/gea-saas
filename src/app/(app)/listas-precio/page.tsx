import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { ListasPrecioClient } from "./ListasPrecioClient";

export default async function ListasPrecioPage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");

  const listas = await prisma.listaPrecio.findMany({
    where: { ferreteriaId: contexto.ferreteriaId },
    orderBy: { nombre: "asc" },
  });

  return (
    <ListasPrecioClient
      listasIniciales={listas}
      puedeCrear={tienePermiso(contexto.rol, "listasPrecio", "crear")}
      puedeEditar={tienePermiso(contexto.rol, "listasPrecio", "modificar")}
      puedeEliminar={tienePermiso(contexto.rol, "listasPrecio", "eliminar")}
    />
  );
}
