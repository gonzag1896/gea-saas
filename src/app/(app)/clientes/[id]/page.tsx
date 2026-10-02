import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { obtenerContextoTenant } from "@/lib/tenant";
import { tienePermiso } from "@/lib/permisos";
import { calcularSaldoCliente } from "@/lib/cuenta-corriente";
import { ClienteCuentaCorrienteClient } from "./ClienteCuentaCorrienteClient";

export default async function ClienteCuentaCorrientePage({ params }: { params: { id: string } }) {
  const contexto = await obtenerContextoTenant();
  if (!contexto) redirect("/login");

  const { ferreteriaId } = contexto;
  const cliente = await prisma.cliente.findUnique({
    where: { id_ferreteriaId: { id: params.id, ferreteriaId } },
    select: { id: true, nombre: true, telefono: true },
  });
  if (!cliente) notFound();

  const [movimientosRaw, saldo, ferreteria] = await Promise.all([
    prisma.cuentaCliente.findMany({ where: { ferreteriaId, clienteId: params.id }, orderBy: { createdAt: "desc" } }),
    calcularSaldoCliente(ferreteriaId, params.id),
    prisma.ferreteria.findUnique({ where: { id: ferreteriaId }, select: { cotizacionDolar: true } }),
  ]);

  // Un cobro está anulado si existe su contraasiento (origenId = id del cobro).
  const cobrosAnulados = new Set(movimientosRaw.filter((m) => m.origenTipo === "ANULACION_COBRO").map((m) => m.origenId));

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
    anulado: m.origenTipo === "COBRO" && cobrosAnulados.has(m.id),
  }));

  const puedeCobrar = tienePermiso(contexto.rol, "cobros", "crear");
  const puedeAnular = tienePermiso(contexto.rol, "cobros", "anular") && !contexto.soporte;

  return (
    <ClienteCuentaCorrienteClient
      cliente={cliente}
      movimientosIniciales={movimientos}
      saldo={saldo}
      cotizacionDolar={ferreteria?.cotizacionDolar?.toString() ?? null}
      puedeCobrar={puedeCobrar}
      puedeAnular={puedeAnular}
    />
  );
}
