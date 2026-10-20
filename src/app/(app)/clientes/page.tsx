import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { ClientesClient } from "./ClientesClient";

export default async function ClientesPage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");

  const filas = await prisma.cliente.findMany({
    where: { ferreteriaId: contexto.ferreteriaId },
    select: {
      id: true, nombre: true, rut: true, telefono: true, ciudad: true, activo: true,
      _count: { select: { ventas: true, cuentaCliente: true } },
    },
    orderBy: { nombre: "asc" },
  });
  // Se puede eliminar de verdad solo un cliente sin ventas ni movimientos
  // de cuenta corriente; el resto se desactiva.
  const clientes = filas.map(({ _count, ...c }) => ({ ...c, eliminable: _count.ventas === 0 && _count.cuentaCliente === 0 }));

  return (
    <ClientesClient
      clientesIniciales={clientes}
      puedeCrear={tienePermiso(contexto.rol, "clientes", "crear")}
      puedeEditar={tienePermiso(contexto.rol, "clientes", "modificar")}
      puedeEliminar={tienePermiso(contexto.rol, "clientes", "eliminar")}
    />
  );
}
