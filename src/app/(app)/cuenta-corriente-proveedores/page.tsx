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
  const [proveedores, saldosPorProveedorYMoneda] = await Promise.all([
    prisma.proveedor.findMany({ where: { ferreteriaId }, select: { id: true, nombre: true, telefono: true }, orderBy: { nombre: "asc" } }),
    prisma.cuentaProveedor.groupBy({ by: ["proveedorId", "moneda"], where: { ferreteriaId }, _sum: { debe: true, haber: true } }),
  ]);

  // Pesos y dólares nunca se mezclan — mismo criterio que la cuenta
  // corriente de clientes.
  const saldosUYU = new Map<string, number>();
  const saldosUSD = new Map<string, number>();
  for (const s of saldosPorProveedorYMoneda) {
    const monto = Number(s._sum.debe ?? 0) - Number(s._sum.haber ?? 0);
    (s.moneda === "UYU" ? saldosUYU : saldosUSD).set(s.proveedorId, monto);
  }
  const filas = proveedores.map((p) => ({ ...p, saldoUYU: saldosUYU.get(p.id) ?? 0, saldoUSD: saldosUSD.get(p.id) ?? 0 }));

  return <CuentaCorrienteProveedoresClient proveedores={filas} />;
}
