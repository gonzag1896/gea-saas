import { prisma } from "@/lib/db";
import { auditar } from "@/lib/auditoria";
import { EstadoInvalidoError, EntidadNoEncontradaError } from "@/lib/errores-dominio";

// Venta.fecha y CierreCaja.fecha son columnas `@db.Date` — Prisma las
// guarda por la fecha calendario en UTC del Date que se les pasa, sin
// importar la hora local. Si acá se usara el huso horario local del
// servidor (getFullYear/getMonth/getDate), en una ferretería de Uruguay
// (GMT-3) esta función calcularía el rango del día "de ayer" durante todo
// el tramo entre las 21:00 y medianoche local, porque para esa fecha en
// UTC ya es mañana — el esperado de caja daba $0 justo en el horario en
// que más se usa, al cerrar el local.
function inicioDelDia(fecha: Date) {
  return new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
}

// [desde, hasta] inclusive en fecha calendario -> [inicioDesde, finHasta)
// para las queries. `hasta` puede ser igual a `desde` (cierre de un solo
// día, el caso normal) o posterior (cierre de un tramo de varios días).
function rangoDe(desde: Date, hasta: Date) {
  const inicio = inicioDelDia(desde);
  const fin = new Date(inicioDelDia(hasta).getTime() + 24 * 60 * 60 * 1000);
  return { inicio, fin };
}

export type EsperadoCaja = { totalVentasContado: number; totalCobrosContado: number; totalEsperado: number };

// Lo único que entra como billete físico a la caja: ventas Contado ya
// confirmadas más los cobros de cuenta corriente marcados Contado.
// Crédito, Transferencia y **Débito** quedan afuera a propósito: una
// venta con tarjeta de débito no pone billetes en el cajón, el banco la
// acredita aparte — contarla acá inflaría el esperado contra plata que
// nunca estuvo físicamente en la caja.
export async function calcularEsperadoCaja(ferreteriaId: string, desde: Date, hasta: Date = desde): Promise<EsperadoCaja> {
  const { inicio, fin } = rangoDe(desde, hasta);

  const [ventas, cobros] = await Promise.all([
    prisma.venta.aggregate({
      where: { ferreteriaId, estado: "CONFIRMADO", medioPago: "CONTADO", fecha: { gte: inicio, lt: fin } },
      _sum: { total: true },
    }),
    prisma.cuentaCliente.aggregate({
      where: { ferreteriaId, origenTipo: "COBRO", medioPago: "CONTADO", fecha: { gte: inicio, lt: fin } },
      _sum: { haber: true },
    }),
  ]);

  const totalVentasContado = Number(ventas._sum.total ?? 0);
  const totalCobrosContado = Number(cobros._sum.haber ?? 0);
  return { totalVentasContado, totalCobrosContado, totalEsperado: totalVentasContado + totalCobrosContado };
}

export type Cierre = {
  id: string;
  fecha: Date;
  fechaHasta: Date;
  montoInicial: number;
  totalVentasContado: number;
  totalCobrosContado: number;
  totalEsperado: number;
  totalContado: number;
  diferencia: number;
  observaciones: string | null;
};

export async function listarCierres(ferreteriaId: string, limite = 30): Promise<Cierre[]> {
  const filas = await prisma.cierreCaja.findMany({
    where: { ferreteriaId },
    orderBy: { fecha: "desc" },
    take: limite,
  });
  return filas.map((f) => ({
    id: f.id,
    fecha: f.fecha,
    fechaHasta: f.fechaHasta,
    montoInicial: Number(f.montoInicial),
    totalVentasContado: Number(f.totalVentasContado),
    totalCobrosContado: Number(f.totalCobrosContado),
    totalEsperado: Number(f.totalEsperado),
    totalContado: Number(f.totalContado),
    diferencia: Number(f.diferencia),
    observaciones: f.observaciones,
  }));
}

// ¿Hay algún cierre que ya cubra (parte de) [desde, hasta]? Reemplaza el
// viejo UNIQUE(ferreteriaId, fecha) de cuando un cierre era siempre de un
// solo día — con rangos, dos cierres se solapan si el inicio de uno cae
// antes del fin del otro y viceversa (superposición de intervalos
// estándar), no si comparten la fecha exacta de inicio.
async function haySolapamiento(ferreteriaId: string, desde: Date, hasta: Date, excluirCierreId?: string) {
  const solapado = await prisma.cierreCaja.findFirst({
    where: {
      ferreteriaId,
      ...(excluirCierreId ? { id: { not: excluirCierreId } } : {}),
      fecha: { lte: inicioDelDia(hasta) },
      fechaHasta: { gte: inicioDelDia(desde) },
    },
  });
  return !!solapado;
}

export async function fechaCubiertaPorCierre(ferreteriaId: string, fecha: Date): Promise<boolean> {
  return haySolapamiento(ferreteriaId, fecha, fecha);
}

export async function registrarCierreCaja(
  ferreteriaId: string,
  usuarioId: string,
  desde: Date,
  hasta: Date,
  montoInicial: number,
  totalContado: number,
  observaciones: string | undefined,
) {
  if (inicioDelDia(hasta).getTime() < inicioDelDia(desde).getTime()) {
    throw new EstadoInvalidoError("La fecha 'hasta' no puede ser anterior a la fecha 'desde'.");
  }
  if (await haySolapamiento(ferreteriaId, desde, hasta)) {
    throw new EstadoInvalidoError("Ya hay un cierre de caja que cubre parte de ese rango de fechas.");
  }

  const { totalVentasContado, totalCobrosContado, totalEsperado: esperadoDelPeriodo } = await calcularEsperadoCaja(ferreteriaId, desde, hasta);
  const totalEsperado = montoInicial + esperadoDelPeriodo;
  const diferencia = totalContado - totalEsperado;

  const cierre = await prisma.cierreCaja.create({
    data: {
      ferreteriaId,
      fecha: inicioDelDia(desde),
      fechaHasta: inicioDelDia(hasta),
      montoInicial,
      totalVentasContado,
      totalCobrosContado,
      totalEsperado,
      totalContado,
      diferencia,
      observaciones,
      registradoPorUsuarioId: usuarioId,
    },
  });

  await auditar({
    accion: "CAJA_CIERRE",
    usuarioId,
    ferreteriaId,
    entidad: "CierreCaja",
    entidadId: cierre.id,
    detalle: { montoInicial, totalEsperado, totalContado, diferencia },
  });

  return cierre;
}

// Corrige un cierre ya cargado (error de tipeo en el monto contado, se
// olvidaron de cargar el fondo inicial, etc.) — nunca reprocesa las
// ventas/cobros del período (totalVentasContado/totalCobrosContado quedan
// como estaban), solo recalcula esperado/diferencia si montoInicial o
// totalContado cambiaron. Restringido a Dueño (permiso "caja"/"modificar")
// en la capa de arriba — acá solo la lógica de negocio.
export async function actualizarCierreCaja(
  ferreteriaId: string,
  cierreId: string,
  usuarioId: string,
  cambios: { montoInicial?: number; totalContado?: number; observaciones?: string },
) {
  const cierre = await prisma.cierreCaja.findUnique({ where: { id: cierreId } });
  if (!cierre || cierre.ferreteriaId !== ferreteriaId) throw new EntidadNoEncontradaError("Cierre de caja no encontrado.");

  const montoInicial = cambios.montoInicial ?? Number(cierre.montoInicial);
  const totalContado = cambios.totalContado ?? Number(cierre.totalContado);
  const totalEsperado = montoInicial + Number(cierre.totalVentasContado) + Number(cierre.totalCobrosContado);
  const diferencia = totalContado - totalEsperado;

  const actualizado = await prisma.cierreCaja.update({
    where: { id: cierreId },
    data: {
      montoInicial,
      totalContado,
      totalEsperado,
      diferencia,
      observaciones: cambios.observaciones !== undefined ? cambios.observaciones : cierre.observaciones,
      actualizadoPorUsuarioId: usuarioId,
    },
  });

  await auditar({
    accion: "CAJA_CIERRE_EDITA",
    usuarioId,
    ferreteriaId,
    entidad: "CierreCaja",
    entidadId: cierreId,
    detalle: { montoInicial, totalContado, totalEsperado, diferencia },
  });

  return actualizado;
}
