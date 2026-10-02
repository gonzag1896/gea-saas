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

export type EsperadoCaja = {
  totalVentasContadoUYU: number; totalVentasContadoUSD: number;
  totalCobrosContadoUYU: number; totalCobrosContadoUSD: number;
  totalEsperadoUYU: number; totalEsperadoUSD: number;
};

// Lo único que entra como billete físico a la caja: ventas Contado ya
// confirmadas más los cobros de cuenta corriente marcados Contado, cada
// moneda por separado (el cajón puede tener pesos y dólares a la vez).
// Crédito, Transferencia y **Débito** quedan afuera a propósito: una
// venta con tarjeta de débito no pone billetes en el cajón, el banco la
// acredita aparte — contarla acá inflaría el esperado contra plata que
// nunca estuvo físicamente en la caja.
export async function calcularEsperadoCaja(ferreteriaId: string, desde: Date, hasta: Date = desde): Promise<EsperadoCaja> {
  const { inicio, fin } = rangoDe(desde, hasta);

  const [ventas, cobros] = await Promise.all([
    prisma.venta.aggregate({
      where: { ferreteriaId, estado: "CONFIRMADO", medioPago: "CONTADO", fecha: { gte: inicio, lt: fin } },
      _sum: { totalUYU: true, totalUSD: true },
    }),
    // Cobros en efectivo del período, netos de las anulaciones hechas en el
    // período: un cobro anulado resta (Debe de ANULACION_COBRO) el día en
    // que se anula, no el día del cobro original — los cierres ya hechos
    // no se recalculan.
    prisma.cuentaCliente.findMany({
      where: { ferreteriaId, origenTipo: { in: ["COBRO", "ANULACION_COBRO"] }, medioPago: "CONTADO", fecha: { gte: inicio, lt: fin } },
      select: { moneda: true, origenTipo: true, haber: true, debe: true, montoRecibido: true, monedaRecibida: true },
    }),
  ]);

  // Caja cuenta lo que realmente entró al cajón: en un cobro cruzado (deuda
  // en pesos pagada con dólares) es el monto recibido en su moneda, no el
  // equivalente que bajó la deuda.
  const cobroPorMoneda = new Map<string, number>();
  for (const c of cobros) {
    const moneda = c.monedaRecibida ?? c.moneda;
    const monto = c.montoRecibido !== null ? Number(c.montoRecibido) : Number(c.origenTipo === "COBRO" ? c.haber : c.debe);
    cobroPorMoneda.set(moneda, (cobroPorMoneda.get(moneda) ?? 0) + (c.origenTipo === "COBRO" ? monto : -monto));
  }
  const totalVentasContadoUYU = Number(ventas._sum.totalUYU ?? 0);
  const totalVentasContadoUSD = Number(ventas._sum.totalUSD ?? 0);
  const totalCobrosContadoUYU = cobroPorMoneda.get("UYU") ?? 0;
  const totalCobrosContadoUSD = cobroPorMoneda.get("USD") ?? 0;
  return {
    totalVentasContadoUYU, totalVentasContadoUSD,
    totalCobrosContadoUYU, totalCobrosContadoUSD,
    totalEsperadoUYU: totalVentasContadoUYU + totalCobrosContadoUYU,
    totalEsperadoUSD: totalVentasContadoUSD + totalCobrosContadoUSD,
  };
}

export type Cierre = {
  id: string;
  fecha: Date;
  fechaHasta: Date;
  montoInicialUYU: number;
  montoInicialUSD: number;
  totalVentasContadoUYU: number;
  totalVentasContadoUSD: number;
  totalCobrosContadoUYU: number;
  totalCobrosContadoUSD: number;
  totalEsperadoUYU: number;
  totalEsperadoUSD: number;
  totalContadoUYU: number;
  totalContadoUSD: number;
  diferenciaUYU: number;
  diferenciaUSD: number;
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
    montoInicialUYU: Number(f.montoInicialUYU),
    montoInicialUSD: Number(f.montoInicialUSD),
    totalVentasContadoUYU: Number(f.totalVentasContadoUYU),
    totalVentasContadoUSD: Number(f.totalVentasContadoUSD),
    totalCobrosContadoUYU: Number(f.totalCobrosContadoUYU),
    totalCobrosContadoUSD: Number(f.totalCobrosContadoUSD),
    totalEsperadoUYU: Number(f.totalEsperadoUYU),
    totalEsperadoUSD: Number(f.totalEsperadoUSD),
    totalContadoUYU: Number(f.totalContadoUYU),
    totalContadoUSD: Number(f.totalContadoUSD),
    diferenciaUYU: Number(f.diferenciaUYU),
    diferenciaUSD: Number(f.diferenciaUSD),
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
  montoInicialUYU: number,
  montoInicialUSD: number,
  totalContadoUYU: number,
  totalContadoUSD: number,
  observaciones: string | undefined,
) {
  if (inicioDelDia(hasta).getTime() < inicioDelDia(desde).getTime()) {
    throw new EstadoInvalidoError("La fecha 'hasta' no puede ser anterior a la fecha 'desde'.");
  }
  if (await haySolapamiento(ferreteriaId, desde, hasta)) {
    throw new EstadoInvalidoError("Ya hay un cierre de caja que cubre parte de ese rango de fechas.");
  }

  const {
    totalVentasContadoUYU, totalVentasContadoUSD,
    totalCobrosContadoUYU, totalCobrosContadoUSD,
    totalEsperadoUYU: esperadoDelPeriodoUYU, totalEsperadoUSD: esperadoDelPeriodoUSD,
  } = await calcularEsperadoCaja(ferreteriaId, desde, hasta);
  const totalEsperadoUYU = montoInicialUYU + esperadoDelPeriodoUYU;
  const totalEsperadoUSD = montoInicialUSD + esperadoDelPeriodoUSD;
  const diferenciaUYU = totalContadoUYU - totalEsperadoUYU;
  const diferenciaUSD = totalContadoUSD - totalEsperadoUSD;

  const cierre = await prisma.cierreCaja.create({
    data: {
      ferreteriaId,
      fecha: inicioDelDia(desde),
      fechaHasta: inicioDelDia(hasta),
      montoInicialUYU,
      montoInicialUSD,
      totalVentasContadoUYU,
      totalVentasContadoUSD,
      totalCobrosContadoUYU,
      totalCobrosContadoUSD,
      totalEsperadoUYU,
      totalEsperadoUSD,
      totalContadoUYU,
      totalContadoUSD,
      diferenciaUYU,
      diferenciaUSD,
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
    detalle: { montoInicialUYU, montoInicialUSD, totalEsperadoUYU, totalEsperadoUSD, totalContadoUYU, totalContadoUSD, diferenciaUYU, diferenciaUSD },
  });

  return cierre;
}

// Corrige un cierre ya cargado (error de tipeo en el monto contado, se
// olvidaron de cargar el fondo inicial, etc.) — nunca reprocesa las
// ventas/cobros del período (totalVentasContado*/totalCobrosContado*
// quedan como estaban), solo recalcula esperado/diferencia de cada moneda
// si cambió algo de esa moneda. Restringido a Dueño (permiso
// "caja"/"modificar") en la capa de arriba — acá solo la lógica de negocio.
export async function actualizarCierreCaja(
  ferreteriaId: string,
  cierreId: string,
  usuarioId: string,
  cambios: { montoInicialUYU?: number; montoInicialUSD?: number; totalContadoUYU?: number; totalContadoUSD?: number; observaciones?: string },
) {
  const cierre = await prisma.cierreCaja.findUnique({ where: { id: cierreId } });
  if (!cierre || cierre.ferreteriaId !== ferreteriaId) throw new EntidadNoEncontradaError("Cierre de caja no encontrado.");

  const montoInicialUYU = cambios.montoInicialUYU ?? Number(cierre.montoInicialUYU);
  const montoInicialUSD = cambios.montoInicialUSD ?? Number(cierre.montoInicialUSD);
  const totalContadoUYU = cambios.totalContadoUYU ?? Number(cierre.totalContadoUYU);
  const totalContadoUSD = cambios.totalContadoUSD ?? Number(cierre.totalContadoUSD);
  const totalEsperadoUYU = montoInicialUYU + Number(cierre.totalVentasContadoUYU) + Number(cierre.totalCobrosContadoUYU);
  const totalEsperadoUSD = montoInicialUSD + Number(cierre.totalVentasContadoUSD) + Number(cierre.totalCobrosContadoUSD);
  const diferenciaUYU = totalContadoUYU - totalEsperadoUYU;
  const diferenciaUSD = totalContadoUSD - totalEsperadoUSD;

  const actualizado = await prisma.cierreCaja.update({
    where: { id: cierreId },
    data: {
      montoInicialUYU,
      montoInicialUSD,
      totalContadoUYU,
      totalContadoUSD,
      totalEsperadoUYU,
      totalEsperadoUSD,
      diferenciaUYU,
      diferenciaUSD,
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
    detalle: { montoInicialUYU, montoInicialUSD, totalContadoUYU, totalContadoUSD, totalEsperadoUYU, totalEsperadoUSD, diferenciaUYU, diferenciaUSD },
  });

  return actualizado;
}
