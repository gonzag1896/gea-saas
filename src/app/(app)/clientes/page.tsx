import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { ClientesClient } from "./ClientesClient";

export default async function ClientesPage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");

  const clientes = await prisma.cliente.findMany({
    where: { ferreteriaId: contexto.ferreteriaId },
    select: { id: true, nombre: true, telefono: true, activo: true },
    orderBy: { nombre: "asc" },
  });

  return (
    <ClientesClient
      clientesIniciales={clientes}
      puedeCrear={tienePermiso(contexto.rol, "clientes", "crear")}
      puedeEditar={tienePermiso(contexto.rol, "clientes", "modificar")}
      puedeEliminar={tienePermiso(contexto.rol, "clientes", "eliminar")}
    />
  );
}
