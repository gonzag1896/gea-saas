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

  const [movimientosRaw, saldo, ferreteria] = await Promise.all([
    prisma.cuentaProveedor.findMany({ where: { ferreteriaId, proveedorId: params.id }, orderBy: { createdAt: "desc" } }),
    calcularSaldoProveedor(ferreteriaId, params.id),
    prisma.ferreteria.findUnique({ where: { id: ferreteriaId }, select: { cotizacionDolar: true } }),
  ]);

  // Un pago está anulado si existe su contraasiento (origenId = id del pago).
  const pagosAnulados = new Set(movimientosRaw.filter((m) => m.origenTipo === "ANULACION_PAGO").map((m) => m.origenId));

  const movimientos = movimientosRaw.map((m) => ({
    id: m.id,
    fecha: m.fecha,
    debe: m.debe.toString(),
    haber: m.haber.toString(),
    moneda: m.moneda,
    origenTipo: m.origenTipo,
    referencia: m.referencia,
    montoRecibido: m.montoRecibido?.toString() ?? null,
    monedaRecibida: m.monedaRecibida,
    cotizacion: m.cotizacion?.toString() ?? null,
    anulado: m.origenTipo === "PAGO" && pagosAnulados.has(m.id),
  }));

  const puedePagar = tienePermiso(contexto.rol, "pagosProveedor", "crear");
  const puedeAnular = tienePermiso(contexto.rol, "pagosProveedor", "anular") && !contexto.soporte;

  return (
    <ProveedorCuentaCorrienteClient
      proveedor={proveedor}
      movimientosIniciales={movimientos}
      saldo={saldo}
      cotizacionDolar={ferreteria?.cotizacionDolar?.toString() ?? null}
      puedePagar={puedePagar}
      puedeAnular={puedeAnular}
    />
  );
}
