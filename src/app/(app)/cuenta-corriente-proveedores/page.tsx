import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { CuentaCorrienteProveedoresClient } from "./CuentaCorrienteProveedoresClient";

export default async function CuentaCorrienteProveedoresPage() {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");
  if (!tienePermiso(contexto.rol, "cuentaProveedores", "ver")) redirect("/dashboard");

  const { ferreteriaId } = contexto;
  const [proveedores, saldosPorProveedor] = await Promise.all([
    prisma.proveedor.findMany({ where: { ferreteriaId }, select: { id: true, nombre: true, telefono: true }, orderBy: { nombre: "asc" } }),
    prisma.cuentaProveedor.groupBy({ by: ["proveedorId"], where: { ferreteriaId }, _sum: { debe: true, haber: true } }),
  ]);

  const saldos = new Map(saldosPorProveedor.map((s) => [s.proveedorId, Number(s._sum.debe ?? 0) - Number(s._sum.haber ?? 0)]));
  const filas = proveedores.map((p) => ({ ...p, saldo: saldos.get(p.id) ?? 0 }));

  return <CuentaCorrienteProveedoresClient proveedores={filas} />;
}
