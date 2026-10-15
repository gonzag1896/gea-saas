import { prisma } from "@/lib/db";
import type { TipoCuenta } from "@/lib/estado-cuenta";
import { generarReciboPdf } from "@/lib/recibo-pdf";

const MEDIO_PAGO: Record<string, string> = { CONTADO: "Efectivo", TRANSFERENCIA: "Transferencia", DEBITO: "Débito" };
const dia = (d: Date) => d.toISOString().slice(0, 10);

// Recibo del cobro (cliente) o comprobante del pago (proveedor) de ESTA
// ferretería. Devuelve null si el movimiento no existe, es de otra
// ferretería o no es un cobro/pago (las ventas y devoluciones no llevan
// recibo).
export async function generarReciboDeMovimiento(
  tipo: TipoCuenta,
  ferreteriaId: string,
  movimientoId: string,
): Promise<{ buffer: Buffer; archivo: string } | null> {
  const ferreteria = await prisma.ferreteria.findUnique({
    where: { id: ferreteriaId },
    select: { nombre: true, razonSocial: true, rut: true, telefono: true, direccion: true },
  });
  if (!ferreteria) return null;

  type Mov = {
    id: string; fecha: Date; createdAt: Date; debe: unknown; haber: unknown; moneda: "UYU" | "USD"; origenTipo: string; referencia: string | null;
    medioPago: string | null; montoRecibido: unknown; monedaRecibida: "UYU" | "USD" | null; cotizacion: unknown;
  };
  let mov: Mov | null;
  let entidad: { nombre: string; rut: string | null } | null = null;
  let saldoDespues = 0;
  let anuladoEl: string | null = null;

  if (tipo === "cliente") {
    const fila = await prisma.cuentaCliente.findUnique({ where: { id_ferreteriaId: { id: movimientoId, ferreteriaId } } });
    if (!fila || fila.origenTipo !== "COBRO") return null;
    mov = fila;
    const clienteId = fila.clienteId;
    entidad = await prisma.cliente.findUnique({ where: { id_ferreteriaId: { id: clienteId, ferreteriaId } }, select: { nombre: true, rut: true } });
    const suma = await prisma.cuentaCliente.aggregate({
      where: { ferreteriaId, clienteId, moneda: mov.moneda, createdAt: { lte: mov.createdAt } },
      _sum: { debe: true, haber: true },
    });
    saldoDespues = Number(suma._sum.debe ?? 0) - Number(suma._sum.haber ?? 0);
    const anulacion = await prisma.cuentaCliente.findFirst({ where: { ferreteriaId, origenTipo: "ANULACION_COBRO", origenId: mov.id }, select: { fecha: true } });
    anuladoEl = anulacion ? dia(anulacion.fecha) : null;
  } else {
    const fila = await prisma.cuentaProveedor.findUnique({ where: { id_ferreteriaId: { id: movimientoId, ferreteriaId } } });
    if (!fila || fila.origenTipo !== "PAGO") return null;
    mov = fila;
    const proveedorId = fila.proveedorId;
    entidad = await prisma.proveedor.findUnique({ where: { id_ferreteriaId: { id: proveedorId, ferreteriaId } }, select: { nombre: true, rut: true } });
    const suma = await prisma.cuentaProveedor.aggregate({
      where: { ferreteriaId, proveedorId, moneda: mov.moneda, createdAt: { lte: mov.createdAt } },
      _sum: { debe: true, haber: true },
    });
    saldoDespues = Number(suma._sum.debe ?? 0) - Number(suma._sum.haber ?? 0);
    const anulacion = await prisma.cuentaProveedor.findFirst({ where: { ferreteriaId, origenTipo: "ANULACION_PAGO", origenId: mov.id }, select: { fecha: true } });
    anuladoEl = anulacion ? dia(anulacion.fecha) : null;
  }
  if (!entidad) return null;

  const importeAplicado = Number(mov.haber);
  const cruzado = mov.montoRecibido !== null && mov.monedaRecibida !== null;
  const numero = `${tipo === "cliente" ? "RC" : "PG"}-${mov.id.slice(-8).toUpperCase()}`;

  const buffer = await generarReciboPdf({
    tipo,
    numero,
    fecha: dia(mov.fecha),
    ferreteria,
    entidad,
    monedaDeuda: mov.moneda,
    importeAplicado,
    recibido: cruzado
      ? { moneda: mov.monedaRecibida!, importe: Number(mov.montoRecibido), cotizacion: Number(mov.cotizacion) }
      : { moneda: mov.moneda, importe: importeAplicado, cotizacion: null },
    medioPago: MEDIO_PAGO[mov.medioPago ?? "CONTADO"] ?? "Efectivo",
    referencia: mov.referencia,
    saldoDespues: Math.round(saldoDespues * 100) / 100,
    anuladoEl,
  });
  return { buffer, archivo: `${tipo === "cliente" ? "recibo" : "comprobante-pago"}-${numero.toLowerCase()}.pdf` };
}
