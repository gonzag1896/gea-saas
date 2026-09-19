import { prisma } from "@/lib/db";
import type { MedioPago } from "@prisma/client";
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

export type ClienteVencido = { id: string; nombre: string; telefono: string | null; saldo: number; diasVencido: number };

// Aproximado a propósito (no hay conciliación factura por factura en este
// libro mayor, ver comentario de calcularSaldoCliente): "vencido" acá es
// saldo a favor de la ferretería cuyo Debe más viejo del cliente tiene más
// de `diasVencimiento` días — no un FIFO exacto contra los cobros
// parciales, pero alcanza para la alerta de "hace cuánto que le fío a
// este cliente sin que pague nada".
export async function clientesConSaldoVencido(ferreteriaId: string, diasVencimiento = 30): Promise<ClienteVencido[]> {
  const [clientes, saldos, primerosDebe] = await Promise.all([
    prisma.cliente.findMany({ where: { ferreteriaId, activo: true }, select: { id: true, nombre: true, telefono: true } }),
    prisma.cuentaCliente.groupBy({ by: ["clienteId"], where: { ferreteriaId }, _sum: { debe: true, haber: true } }),
    prisma.cuentaCliente.groupBy({ by: ["clienteId"], where: { ferreteriaId, debe: { gt: 0 } }, _min: { fecha: true } }),
  ]);

  const saldoPorCliente = new Map(saldos.map((s) => [s.clienteId, Number(s._sum.debe ?? 0) - Number(s._sum.haber ?? 0)]));
  const primerDebePorCliente = new Map(primerosDebe.map((p) => [p.clienteId, p._min.fecha]));

  const hoyMs = Date.now();
  const vencidos: ClienteVencido[] = [];
  for (const c of clientes) {
    const saldo = saldoPorCliente.get(c.id) ?? 0;
    const primerDebe = primerDebePorCliente.get(c.id);
    if (saldo <= 0 || !primerDebe) continue;

    const diasVencido = Math.floor((hoyMs - primerDebe.getTime()) / 86_400_000);
    if (diasVencido >= diasVencimiento) vencidos.push({ id: c.id, nombre: c.nombre, telefono: c.telefono, saldo, diasVencido });
  }

  return vencidos.sort((a, b) => b.diasVencido - a.diasVencido);
}

// PrcRegistrarCobro: un Haber suelto, sin atarlo a ninguna venta en
// particular — el cliente paga contra su saldo general, no factura por
// factura (mismo modelo que el sistema original). Sin tope contra el
// saldo (decisión pendiente #2 del informe, sin cerrar: se deja sin
// límite en MVP, igual que GeneXus).
// `medioPago` sin CREDITO tiene sentido (default CONTADO): un cobro
// siempre es plata que entra ahora, nunca a crédito. Lo usa el Cierre de
// Caja del día para saber qué cobros efectivamente entraron como billete
// (CONTADO) contra los que fueron por transferencia.
export async function registrarCobro(
  ferreteriaId: string,
  clienteId: string,
  monto: number,
  usuarioId: string,
  referencia?: string,
  medioPago: Exclude<MedioPago, "CREDITO"> = "CONTADO",
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
      medioPago,
      registradoPorUsuarioId: usuarioId,
    },
  });

  await auditar({
    accion: "COBRO_REGISTRA",
    usuarioId,
    ferreteriaId,
    entidad: "Cliente",
    entidadId: clienteId,
    detalle: { monto, referencia, medioPago },
  });
}
