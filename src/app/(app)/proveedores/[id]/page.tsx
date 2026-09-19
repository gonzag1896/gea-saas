import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { calcularSaldoProveedor } from "@/lib/cuenta-proveedor";
import { ProveedorCuentaCorrienteClient } from "./ProveedorCuentaCorrienteClient";

export default async function ProveedorCuentaCorrientePage({ params }: { params: { id: string } }) {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");
  if (!tienePermiso(contexto.rol, "cuentaProveedores", "ver")) redirect("/dashboard");

  const { ferreteriaId } = contexto;
  const proveedor = await prisma.proveedor.findUnique({
    where: { id_ferreteriaId: { id: params.id, ferreteriaId } },
    select: { id: true, nombre: true, telefono: true },
  });
  if (!proveedor) notFound();

  const [movimientosRaw, saldo] = await Promise.all([
    prisma.cuentaProveedor.findMany({ where: { ferreteriaId, proveedorId: params.id }, orderBy: { createdAt: "asc" } }),
    calcularSaldoProveedor(ferreteriaId, params.id),
  ]);

  const movimientos = movimientosRaw.map((m) => ({
    id: m.id,
    fecha: m.fecha,
    debe: m.debe.toString(),
    haber: m.haber.toString(),
    origenTipo: m.origenTipo,
    referencia: m.referencia,
  }));

  const puedePagar = tienePermiso(contexto.rol, "pagosProveedor", "crear");

  return <ProveedorCuentaCorrienteClient proveedor={proveedor} movimientosIniciales={movimientos} saldo={saldo} puedePagar={puedePagar} />;
}
