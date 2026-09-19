import { prisma } from "@/lib/db";
import { auditar } from "@/lib/auditoria";
import { EstadoInvalidoError } from "@/lib/errores-dominio";

// Venta.fecha y CierreCaja.fecha son columnas `@db.Date` — Prisma las
// guarda por la fecha calendario en UTC del Date que se les pasa, sin
// importar la hora local. Si acá se usara el huso horario local del
// servidor (getFullYear/getMonth/getDate), en una ferretería de Uruguay
// (GMT-3) esta función calcularía el rango del día "de ayer" durante todo
// el tramo entre las 21:00 y medianoche local, porque para esa fecha en
// UTC ya es mañana — el esperado de caja daba $0 justo en el horario en
// que más se usa, al cerrar el local.
function rangoDelDia(fecha: Date) {
  const inicio = new Date(Date.UTC(fecha.getUTCFullYear(), fecha.getUTCMonth(), fecha.getUTCDate()));
  const fin = new Date(inicio.getTime() + 24 * 60 * 60 * 1000);
  return { inicio, fin };
}

export type EsperadoCaja = { totalVentasContado: number; totalCobrosContado: number; totalEsperado: number };

// Lo único que entra como billete físico a la caja: ventas Contado ya
// confirmadas (Crédito y Transferencia no tocan la caja) más los cobros
// de cuenta corriente marcados Contado (Transferencia tampoco).
export async function calcularEsperadoCaja(ferreteriaId: string, fecha: Date): Promise<EsperadoCaja> {
  const { inicio, fin } = rangoDelDia(fecha);

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
    totalVentasContado: Number(f.totalVentasContado),
    totalCobrosContado: Number(f.totalCobrosContado),
    totalEsperado: Number(f.totalEsperado),
    totalContado: Number(f.totalContado),
    diferencia: Number(f.diferencia),
    observaciones: f.observaciones,
  }));
}

// Un cierre por día (UNIQUE ferreteriaId+fecha, ver schema) — el guard acá
// da un mensaje legible en vez de dejar que el 500 de Postgres se filtre.
export async function registrarCierreCaja(
  ferreteriaId: string,
  usuarioId: string,
  fecha: Date,
  totalContado: number,
  observaciones: string | undefined,
) {
  const { inicio } = rangoDelDia(fecha);

  const yaExiste = await prisma.cierreCaja.findUnique({ where: { ferreteriaId_fecha: { ferreteriaId, fecha: inicio } } });
  if (yaExiste) throw new EstadoInvalidoError("Ya se cerró la caja de ese día.");

  const { totalVentasContado, totalCobrosContado, totalEsperado } = await calcularEsperadoCaja(ferreteriaId, fecha);
  const diferencia = totalContado - totalEsperado;

  const cierre = await prisma.cierreCaja.create({
    data: {
      ferreteriaId,
      fecha: inicio,
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
    detalle: { totalEsperado, totalContado, diferencia },
  });

  return cierre;
}
