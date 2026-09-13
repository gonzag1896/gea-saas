import { prisma } from "@/lib/db";
import { auditar } from "@/lib/auditoria";

// SaldoCliente del sistema original: pura lectura, sin efectos —
// Σ Debe − Σ Haber sobre el libro mayor completo del cliente. No hay un
// campo "saldo" guardado en ningún lado a propósito: guardarlo sería un
// número que se puede desincronizar del historial real (mismo criterio
// que stockActual, pero para plata en vez de mercadería).
export async function calcularSaldoCliente(ferreteriaId: string, clienteId: string): Promise<number> {
  const resultado = await prisma.cuentaCliente.aggregate({
    where: { ferreteriaId, clienteId },
    _sum: { debe: true, haber: true },
  });
  return Number(resultado._sum.debe ?? 0) - Number(resultado._sum.haber ?? 0);
}

// PrcRegistrarCobro: un Haber suelto, sin atarlo a ninguna venta en
// particular — el cliente paga contra su saldo general, no factura por
// factura (mismo modelo que el sistema original). Sin tope contra el
// saldo (decisión pendiente #2 del informe, sin cerrar: se deja sin
// límite en MVP, igual que GeneXus).
export async function registrarCobro(
  ferreteriaId: string,
  clienteId: string,
  monto: number,
  usuarioId: string,
  referencia?: string,
) {
  await prisma.cuentaCliente.create({
    data: {
      ferreteriaId,
      clienteId,
      fecha: new Date(),
      debe: 0,
      haber: monto,
      origenTipo: "COBRO",
      referencia,
      registradoPorUsuarioId: usuarioId,
    },
  });

  await auditar({
    accion: "COBRO_REGISTRA",
    usuarioId,
    ferreteriaId,
    entidad: "Cliente",
    entidadId: clienteId,
    detalle: { monto, referencia },
  });
}
