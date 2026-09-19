import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { ProveedoresClient } from "./ProveedoresClient";

export default async function ProveedoresPage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");

  const proveedores = await prisma.proveedor.findMany({
    where: { ferreteriaId: contexto.ferreteriaId },
    select: { id: true, nombre: true, rut: true, telefono: true, email: true, activo: true },
    orderBy: { nombre: "asc" },
  });

  return (
    <ProveedoresClient
      proveedoresIniciales={proveedores}
      puedeCrear={tienePermiso(contexto.rol, "proveedores", "crear")}
      puedeEditar={tienePermiso(contexto.rol, "proveedores", "modificar")}
      puedeEliminar={tienePermiso(contexto.rol, "proveedores", "eliminar")}
    />
  );
}
