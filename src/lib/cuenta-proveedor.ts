import { prisma } from "@/lib/db";
import type { MedioPago, Moneda } from "@prisma/client";
import { auditar } from "@/lib/auditoria";
import type { SaldoPorMoneda } from "@/lib/cuenta-corriente";
import { EntidadNoEncontradaError, EstadoInvalidoError } from "@/lib/errores-dominio";
import { resolverMontos, type Cruce } from "@/lib/cobro-cruzado";

// Espejo de calcularSaldoCliente del otro lado del mostrador: Σ Debe −
// Σ Haber sobre el libro mayor del proveedor, por moneda. Positivo = le
// debemos (en esa moneda).
export async function calcularSaldoProveedor(ferreteriaId: string, proveedorId: string): Promise<SaldoPorMoneda> {
  const resultado = await prisma.cuentaProveedor.groupBy({
    by: ["moneda"],
    where: { ferreteriaId, proveedorId },
    _sum: { debe: true, haber: true },
  });
  const porMoneda = new Map(resultado.map((r) => [r.moneda, Number(r._sum.debe ?? 0) - Number(r._sum.haber ?? 0)]));
  return { saldoUYU: porMoneda.get("UYU") ?? 0, saldoUSD: porMoneda.get("USD") ?? 0 };
}

export type SaldoProveedor = { id: string; nombre: string; rut: string | null; saldoUYU: number; saldoUSD: number };

export async function saldosPorProveedor(ferreteriaId: string): Promise<SaldoProveedor[]> {
  const [proveedores, saldos] = await Promise.all([
    prisma.proveedor.findMany({ where: { ferreteriaId }, select: { id: true, nombre: true, rut: true }, orderBy: { nombre: "asc" } }),
    prisma.cuentaProveedor.groupBy({ by: ["proveedorId", "moneda"], where: { ferreteriaId }, _sum: { debe: true, haber: true } }),
  ]);

  const porProveedor = new Map<string, SaldoPorMoneda>();
  for (const s of saldos) {
    const actual = porProveedor.get(s.proveedorId) ?? { saldoUYU: 0, saldoUSD: 0 };
    const monto = Number(s._sum.debe ?? 0) - Number(s._sum.haber ?? 0);
    if (s.moneda === "UYU") actual.saldoUYU = monto; else actual.saldoUSD = monto;
    porProveedor.set(s.proveedorId, actual);
  }
  return proveedores.map((p) => ({ ...p, ...(porProveedor.get(p.id) ?? { saldoUYU: 0, saldoUSD: 0 }) }));
}

// Pago a proveedor: un Haber suelto contra el saldo general, igual que
// registrarCobro con el cliente — no se imputa factura por factura. Un
// pago es siempre en una sola moneda, igual criterio que los cobros.
export async function registrarPagoProveedor(
  ferreteriaId: string,
  proveedorId: string,
  monto: number,
  usuarioId: string,
  referencia?: string,
  medioPago: Exclude<MedioPago, "CREDITO"> = "CONTADO",
  moneda: Moneda = "UYU",
  cruce?: Cruce,
) {
  // Con cruce, `monto` es lo entregado en `cruce.monedaRecibida` y `moneda`
  // es la deuda que cancela (ver cobro-cruzado.ts).
  const { haber, ...entregado } = resolverMontos(monto, moneda, cruce);
  await prisma.cuentaProveedor.create({
    data: {
      ferreteriaId,
      proveedorId,
      fecha: new Date(),
      debe: 0,
      haber,
      moneda,
      ...entregado,
      origenTipo: "PAGO",
      referencia,
      medioPago,
      registradoPorUsuarioId: usuarioId,
    },
  });

  await auditar({
    accion: "PAGO_PROVEEDOR_REGISTRA",
    usuarioId,
    ferreteriaId,
    entidad: "Proveedor",
    entidadId: proveedorId,
    detalle: { monto, moneda, referencia, medioPago, ...(cruce && { cruce }) },
  });
}

// Espejo de anularCobro (@/lib/cuenta-corriente): un pago a proveedor
// cargado por error se anula con un contraasiento (Debe por el mismo monto
// y moneda, origenId = id del pago), sin tocar el original.
export async function anularPagoProveedor(ferreteriaId: string, movimientoId: string, usuarioId: string, motivo: string) {
  const pago = await prisma.cuentaProveedor.findUnique({ where: { id_ferreteriaId: { id: movimientoId, ferreteriaId } } });
  if (!pago) throw new EntidadNoEncontradaError("Pago no encontrado.");
  if (pago.origenTipo !== "PAGO") throw new EstadoInvalidoError("Solo se pueden anular pagos.");

  try {
    await prisma.cuentaProveedor.create({
      data: {
        ferreteriaId,
        proveedorId: pago.proveedorId,
        fecha: new Date(),
        debe: pago.haber,
        haber: 0,
        moneda: pago.moneda,
        origenTipo: "ANULACION_PAGO",
        origenId: pago.id,
        referencia: `Anulación: ${motivo}`,
        medioPago: pago.medioPago,
        montoRecibido: pago.montoRecibido,
        monedaRecibida: pago.monedaRecibida,
        cotizacion: pago.cotizacion,
        registradoPorUsuarioId: usuarioId,
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      throw new EstadoInvalidoError("Ese pago ya fue anulado.");
    }
    throw error;
  }

  await auditar({
    accion: "PAGO_PROVEEDOR_ANULA",
    usuarioId,
    ferreteriaId,
    entidad: "Proveedor",
    entidadId: pago.proveedorId,
    detalle: { pagoId: pago.id, monto: pago.haber.toString(), moneda: pago.moneda, motivo },
  });
}
