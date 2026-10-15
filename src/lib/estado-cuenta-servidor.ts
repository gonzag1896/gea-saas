import { prisma } from "@/lib/db";
import { armarEstadoCuenta, monedasConMovimientos, type MovimientoCuenta, type Periodo, type TipoCuenta } from "@/lib/estado-cuenta";
import { generarEstadoCuentaPdf } from "@/lib/estado-cuenta-pdf";

const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;

export function periodoDesdeParams(params: URLSearchParams): Periodo {
  const desde = params.get("desde");
  const hasta = params.get("hasta");
  return { desde: desde && FECHA_ISO.test(desde) ? desde : undefined, hasta: hasta && FECHA_ISO.test(hasta) ? hasta : undefined };
}

const sinAcentos = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "");
const slug = (s: string) => sinAcentos(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "cuenta";

// Arma el PDF del estado de cuenta de un cliente o proveedor de ESTA
// ferretería. Devuelve null si la entidad no existe (o es de otra ferretería).
export async function generarEstadoCuentaDeEntidad(
  tipo: TipoCuenta,
  ferreteriaId: string,
  entidadId: string,
  periodo: Periodo,
): Promise<{ buffer: Buffer; archivo: string } | null> {
  const ferreteria = await prisma.ferreteria.findUnique({
    where: { id: ferreteriaId },
    select: { nombre: true, razonSocial: true, rut: true, telefono: true, direccion: true },
  });
  if (!ferreteria) return null;

  let entidad: { nombre: string; rut: string | null; telefono: string | null } | null;
  let filas: {
    id: string; fecha: Date; createdAt: Date; debe: unknown; haber: unknown; moneda: "UYU" | "USD"; origenTipo: string; origenId: string | null;
    referencia: string | null; montoRecibido: unknown; monedaRecibida: "UYU" | "USD" | null; cotizacion: unknown;
  }[];

  if (tipo === "cliente") {
    entidad = await prisma.cliente.findUnique({ where: { id_ferreteriaId: { id: entidadId, ferreteriaId } }, select: { nombre: true, rut: true, telefono: true } });
    if (!entidad) return null;
    filas = await prisma.cuentaCliente.findMany({ where: { ferreteriaId, clienteId: entidadId } });
  } else {
    entidad = await prisma.proveedor.findUnique({ where: { id_ferreteriaId: { id: entidadId, ferreteriaId } }, select: { nombre: true, rut: true, telefono: true } });
    if (!entidad) return null;
    filas = await prisma.cuentaProveedor.findMany({ where: { ferreteriaId, proveedorId: entidadId } });
  }

  const tipoAnulacion = tipo === "cliente" ? "ANULACION_COBRO" : "ANULACION_PAGO";
  const tipoOriginal = tipo === "cliente" ? "COBRO" : "PAGO";
  const anulados = new Set(filas.filter((f) => f.origenTipo === tipoAnulacion).map((f) => f.origenId));

  const movimientos: MovimientoCuenta[] = filas.map((f) => ({
    id: f.id,
    fecha: f.fecha,
    createdAt: f.createdAt,
    debe: String(f.debe),
    haber: String(f.haber),
    moneda: f.moneda,
    origenTipo: f.origenTipo,
    referencia: f.referencia,
    anulado: f.origenTipo === tipoOriginal && anulados.has(f.id),
    montoRecibido: f.montoRecibido === null ? null : String(f.montoRecibido),
    monedaRecibida: f.monedaRecibida,
    cotizacion: f.cotizacion === null ? null : String(f.cotizacion),
  }));

  const estados = monedasConMovimientos(movimientos).map((m) => armarEstadoCuenta(tipo, movimientos, m, periodo));
  const buffer = await generarEstadoCuentaPdf({ tipo, ferreteria, entidad, periodo, estados });
  const fecha = new Date().toISOString().slice(0, 10);
  return { buffer, archivo: `estado-de-cuenta-${slug(entidad.nombre)}-${fecha}.pdf` };
}
