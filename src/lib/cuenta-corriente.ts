import { prisma } from "@/lib/db";
import type { MedioPago, Moneda } from "@prisma/client";
import { auditar } from "@/lib/auditoria";
import { EntidadNoEncontradaError, EstadoInvalidoError } from "@/lib/errores-dominio";
import { resolverMontos, type Cruce } from "@/lib/cobro-cruzado";

export type SaldoPorMoneda = { saldoUYU: number; saldoUSD: number };

// SaldoCliente del sistema original: pura lectura, sin efectos —
// Σ Debe − Σ Haber sobre el libro mayor completo del cliente, agrupado por
// moneda (pesos y dólares nunca se mezclan ni se convierten entre sí). No
// hay un campo "saldo" guardado en ningún lado a propósito: guardarlo sería
// un número que se puede desincronizar del historial real (mismo criterio
// que stockActual, pero para plata en vez de mercadería).
export async function calcularSaldoCliente(ferreteriaId: string, clienteId: string): Promise<SaldoPorMoneda> {
  const resultado = await prisma.cuentaCliente.groupBy({
    by: ["moneda"],
    where: { ferreteriaId, clienteId },
    _sum: { debe: true, haber: true },
  });
  const porMoneda = new Map(resultado.map((r) => [r.moneda, Number(r._sum.debe ?? 0) - Number(r._sum.haber ?? 0)]));
  return { saldoUYU: porMoneda.get("UYU") ?? 0, saldoUSD: porMoneda.get("USD") ?? 0 };
}

export type ClienteVencido = { id: string; nombre: string; telefono: string | null; saldoUYU: number; saldoUSD: number; diasVencido: number };

// Aproximado a propósito (no hay conciliación factura por factura en este
// libro mayor, ver comentario de calcularSaldoCliente): "vencido" acá es
// que el cliente tiene saldo a favor de la ferretería (en cualquiera de
// las dos monedas) y su Debe más viejo (de cualquier moneda) tiene más de
// `diasVencimiento` días — no un FIFO exacto contra los cobros parciales,
// pero alcanza para la alerta de "hace cuánto que le fío a este cliente
// sin que pague nada".
export async function clientesConSaldoVencido(ferreteriaId: string, diasVencimiento = 30): Promise<ClienteVencido[]> {
  const [clientes, saldos, primerosDebe] = await Promise.all([
    prisma.cliente.findMany({ where: { ferreteriaId, activo: true }, select: { id: true, nombre: true, telefono: true } }),
    prisma.cuentaCliente.groupBy({ by: ["clienteId", "moneda"], where: { ferreteriaId }, _sum: { debe: true, haber: true } }),
    prisma.cuentaCliente.groupBy({ by: ["clienteId"], where: { ferreteriaId, debe: { gt: 0 } }, _min: { fecha: true } }),
  ]);

  const saldosPorCliente = new Map<string, SaldoPorMoneda>();
  for (const s of saldos) {
    const actual = saldosPorCliente.get(s.clienteId) ?? { saldoUYU: 0, saldoUSD: 0 };
    const monto = Number(s._sum.debe ?? 0) - Number(s._sum.haber ?? 0);
    if (s.moneda === "UYU") actual.saldoUYU = monto; else actual.saldoUSD = monto;
    saldosPorCliente.set(s.clienteId, actual);
  }
  const primerDebePorCliente = new Map(primerosDebe.map((p) => [p.clienteId, p._min.fecha]));

  const hoyMs = Date.now();
  const vencidos: ClienteVencido[] = [];
  for (const c of clientes) {
    const { saldoUYU, saldoUSD } = saldosPorCliente.get(c.id) ?? { saldoUYU: 0, saldoUSD: 0 };
    const primerDebe = primerDebePorCliente.get(c.id);
    if ((saldoUYU <= 0 && saldoUSD <= 0) || !primerDebe) continue;

    const diasVencido = Math.floor((hoyMs - primerDebe.getTime()) / 86_400_000);
    if (diasVencido >= diasVencimiento) vencidos.push({ id: c.id, nombre: c.nombre, telefono: c.telefono, saldoUYU, saldoUSD, diasVencido });
  }

  return vencidos.sort((a, b) => b.diasVencido - a.diasVencido);
}

// PrcRegistrarCobro: un Haber suelto, sin atarlo a ninguna venta en
// particular — el cliente paga contra su saldo general, no factura por
// factura (mismo modelo que el sistema original). Sin tope contra el
// saldo (decisión pendiente #2 del informe, sin cerrar: se deja sin
// límite en MVP, igual que GeneXus). Un cobro es siempre en una sola
// moneda — si el cliente paga parte en pesos y parte en dólares, son dos
// cobros separados, cada uno reduce el saldo de su propia moneda.
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
  moneda: Moneda = "UYU",
  cruce?: Cruce,
) {
  // Con cruce, `monto` es lo recibido en `cruce.monedaRecibida` y `moneda`
  // es la deuda que cancela (ver cobro-cruzado.ts).
  const { haber, ...recibido } = resolverMontos(monto, moneda, cruce);
  await prisma.cuentaCliente.create({
    data: {
      ferreteriaId,
      clienteId,
      fecha: new Date(),
      debe: 0,
      haber,
      moneda,
      ...recibido,
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
    detalle: { monto, moneda, referencia, medioPago, ...(cruce && { cruce }) },
  });
}

// Anula un cobro cargado por error. El libro es append-only: el cobro NO
// se modifica ni se borra — se agrega un contraasiento (Debe por el mismo
// monto y moneda, con origenId = id del cobro), y "este cobro está anulado"
// se deduce de que ese contraasiento existe. Conserva el medioPago del
// cobro: si fue en efectivo (CONTADO), el cierre de caja lo descuenta a
// partir de hoy (los cierres ya hechos no se recalculan). El UNIQUE parcial
// de la base impide anular dos veces el mismo cobro aunque lleguen dos
// pedidos a la vez.
export async function anularCobro(ferreteriaId: string, movimientoId: string, usuarioId: string, motivo: string) {
  const cobro = await prisma.cuentaCliente.findUnique({ where: { id_ferreteriaId: { id: movimientoId, ferreteriaId } } });
  if (!cobro) throw new EntidadNoEncontradaError("Cobro no encontrado.");
  if (cobro.origenTipo !== "COBRO") throw new EstadoInvalidoError("Solo se pueden anular cobros.");

  try {
    await prisma.cuentaCliente.create({
      data: {
        ferreteriaId,
        clienteId: cobro.clienteId,
        fecha: new Date(),
        debe: cobro.haber,
        haber: 0,
        moneda: cobro.moneda,
        origenTipo: "ANULACION_COBRO",
        origenId: cobro.id,
        referencia: `Anulación: ${motivo}`,
        medioPago: cobro.medioPago,
        // Si fue cruzado, el contraasiento también revierte lo recibido (Caja).
        montoRecibido: cobro.montoRecibido,
        monedaRecibida: cobro.monedaRecibida,
        cotizacion: cobro.cotizacion,
        registradoPorUsuarioId: usuarioId,
      },
    });
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      throw new EstadoInvalidoError("Ese cobro ya fue anulado.");
    }
    throw error;
  }

  await auditar({
    accion: "COBRO_ANULA",
    usuarioId,
    ferreteriaId,
    entidad: "Cliente",
    entidadId: cobro.clienteId,
    detalle: { cobroId: cobro.id, monto: cobro.haber.toString(), moneda: cobro.moneda, motivo },
  });
}
