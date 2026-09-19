import { prisma } from "@/lib/db";
import type { MedioPago } from "@prisma/client";
import { auditar } from "@/lib/auditoria";

// Espejo de calcularSaldoCliente del otro lado del mostrador: Σ Debe −
// Σ Haber sobre el libro mayor del proveedor. Positivo = le debemos.
export async function calcularSaldoProveedor(ferreteriaId: string, proveedorId: string): Promise<number> {
  const resultado = await prisma.cuentaProveedor.aggregate({
    where: { ferreteriaId, proveedorId },
    _sum: { debe: true, haber: true },
  });
  return Number(resultado._sum.debe ?? 0) - Number(resultado._sum.haber ?? 0);
}

export type SaldoProveedor = { id: string; nombre: string; rut: string | null; saldo: number };

export async function saldosPorProveedor(ferreteriaId: string): Promise<SaldoProveedor[]> {
  const [proveedores, saldos] = await Promise.all([
    prisma.proveedor.findMany({ where: { ferreteriaId }, select: { id: true, nombre: true, rut: true }, orderBy: { nombre: "asc" } }),
    prisma.cuentaProveedor.groupBy({ by: ["proveedorId"], where: { ferreteriaId }, _sum: { debe: true, haber: true } }),
  ]);

  const porProveedor = new Map(saldos.map((s) => [s.proveedorId, Number(s._sum.debe ?? 0) - Number(s._sum.haber ?? 0)]));
  return proveedores.map((p) => ({ ...p, saldo: porProveedor.get(p.id) ?? 0 }));
}

// Pago a proveedor: un Haber suelto contra el saldo general, igual que
// registrarCobro con el cliente — no se imputa factura por factura.
export async function registrarPagoProveedor(
  ferreteriaId: string,
  proveedorId: string,
  monto: number,
  usuarioId: string,
  referencia?: string,
  medioPago: Exclude<MedioPago, "CREDITO"> = "CONTADO",
) {
  await prisma.cuentaProveedor.create({
    data: {
      ferreteriaId,
      proveedorId,
      fecha: new Date(),
      debe: 0,
      haber: monto,
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
    detalle: { monto, referencia, medioPago },
  });
}
