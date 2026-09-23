import { prisma } from "@/lib/db";
import { auditar } from "@/lib/auditoria";
import { crearUsuario } from "@/lib/usuarios";
import { sumarUnMes } from "@/lib/fecha";
import { EntidadNoEncontradaError } from "@/lib/errores-dominio";

export type FerreteriaConResumen = {
  id: string;
  nombre: string;
  slug: string | null;
  estado: "ACTIVO" | "INACTIVO";
  createdAt: Date;
  vigenciaHasta: Date | null;
  cantidadUsuarios: number;
  cantidadProductos: number;
  ultimoMonto: number | null;
};

export async function listarFerreterias(): Promise<FerreteriaConResumen[]> {
  const ferreterias = await prisma.ferreteria.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          usuarios: { where: { estado: "ACTIVO" } },
          productos: true,
        },
      },
    },
  });

  // Último monto pagado por ferretería, para estimar el ingreso mensual
  // en el panel — una sola consulta ordenada por fecha en vez de N
  // findFirst (la cantidad de ferreterías es chica, pero no hay motivo
  // para pagar N round-trips pudiendo pagar 1).
  const pagos = await prisma.pagoPlataforma.findMany({
    orderBy: { fecha: "desc" },
    select: { ferreteriaId: true, monto: true, esGratis: true },
  });
  const ultimoMontoPorFerreteria = new Map<string, number | null>();
  for (const p of pagos) {
    // Un mes gratis no aporta al ingreso estimado — se ignora acá y se
    // sigue buscando el último pago REAL para esa ferretería.
    if (p.esGratis) continue;
    if (!ultimoMontoPorFerreteria.has(p.ferreteriaId)) {
      ultimoMontoPorFerreteria.set(p.ferreteriaId, p.monto ? Number(p.monto) : null);
    }
  }

  return ferreterias.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    slug: f.slug,
    estado: f.estado,
    createdAt: f.createdAt,
    vigenciaHasta: f.vigenciaHasta,
    cantidadUsuarios: f._count.usuarios,
    cantidadProductos: f._count.productos,
    ultimoMonto: ultimoMontoPorFerreteria.get(f.id) ?? null,
  }));
}

function slugBase(nombre: string): string {
  return nombre
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // saca acentos
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    || "ferreteria";
}

async function generarSlugUnico(nombre: string): Promise<string> {
  const base = slugBase(nombre);
  let slug = base;
  let sufijo = 2;
  while (await prisma.ferreteria.findUnique({ where: { slug } })) {
    slug = `${base}-${sufijo}`;
    sufijo++;
  }
  return slug;
}

// Alta de un tenant nuevo — fuera de la matriz de permisos por-ferretería
// a propósito (ver src/lib/permisos.ts): la ejecuta el Super Admin sobre
// la plataforma, no un rol dentro de una ferretería. Crea la Ferretería y,
// reusando crearUsuario() (mismo camino que "Nuevo usuario" dentro de una
// ferretería), su primer Dueño.
export async function crearFerreteria(
  datos: { nombre: string; duenoNombre: string; duenoEmail: string; duenoPassword: string },
  usuarioQueEjecuta: string,
) {
  const slug = await generarSlugUnico(datos.nombre);

  const ferreteria = await prisma.ferreteria.create({
    data: { nombre: datos.nombre, slug },
  });

  await crearUsuario(ferreteria.id, {
    email: datos.duenoEmail,
    nombre: datos.duenoNombre,
    rol: "DUENO",
    password: datos.duenoPassword,
  });

  await auditar({
    accion: "FERRETERIA_CREA",
    usuarioId: usuarioQueEjecuta,
    ferreteriaId: ferreteria.id,
    entidad: "Ferreteria",
    entidadId: ferreteria.id,
    detalle: { nombre: ferreteria.nombre, slug, duenoEmail: datos.duenoEmail },
  });

  return ferreteria;
}

export type PagoPlataformaListado = {
  id: string;
  fecha: Date;
  monto: string | null;
  esGratis: boolean;
  vigenciaDesde: Date;
  vigenciaHasta: Date;
  registradoPorNombre: string | null;
};

export async function listarPagosPlataforma(ferreteriaId: string): Promise<PagoPlataformaListado[]> {
  const pagos = await prisma.pagoPlataforma.findMany({
    where: { ferreteriaId },
    orderBy: { fecha: "desc" },
    include: { registradoPor: { select: { name: true, email: true } } },
  });

  return pagos.map((p) => ({
    id: p.id,
    fecha: p.fecha,
    monto: p.monto?.toString() ?? null,
    esGratis: p.esGratis,
    vigenciaDesde: p.vigenciaDesde,
    vigenciaHasta: p.vigenciaHasta,
    registradoPorNombre: p.registradoPor ? (p.registradoPor.name ?? p.registradoPor.email) : null,
  }));
}

// Recalcula el campo cacheado Ferreteria.vigenciaHasta como el máximo
// entre todos sus pagos — fuente de verdad después de editar un pago
// cualquiera (no necesariamente el último cronológicamente).
async function recalcularVigenciaCacheada(ferreteriaId: string) {
  const ultimo = await prisma.pagoPlataforma.findFirst({
    where: { ferreteriaId },
    orderBy: { vigenciaHasta: "desc" },
    select: { vigenciaHasta: true },
  });
  await prisma.ferreteria.update({
    where: { id: ferreteriaId },
    data: { vigenciaHasta: ultimo?.vigenciaHasta ?? null },
  });
}

// Registra un cobro (o una cortesía "mes gratis") de la mensualidad.
// Por defecto la vigencia se extiende un mes desde donde correspondía: si
// la ferretería todavía tenía vigencia futura, se suma sobre esa fecha
// (pagar antes de que venza no "pierde" los días que ya estaban pagos);
// si ya había vencido (o nunca tuvo), se cuenta un mes desde la fecha del
// pago. `vigenciaHastaManual` permite fijar una fecha exacta en vez de
// ese cálculo (ej. una cortesía "hasta el 10/10" que no es un mes redondo).
export async function registrarPagoPlataforma(
  ferreteriaId: string,
  datos: { fecha: Date; monto?: number; esGratis?: boolean; vigenciaHastaManual?: Date },
  usuarioQueEjecuta: string,
) {
  const ferreteria = await prisma.ferreteria.findUnique({ where: { id: ferreteriaId } });
  if (!ferreteria) throw new EntidadNoEncontradaError("Ferretería no encontrada.");

  const vigenciaPrevia = ferreteria.vigenciaHasta;
  const base = vigenciaPrevia && vigenciaPrevia.getTime() > datos.fecha.getTime() ? vigenciaPrevia : datos.fecha;
  const nuevaVigencia = datos.vigenciaHastaManual ?? sumarUnMes(base);
  const monto = datos.esGratis ? undefined : datos.monto;

  const [, pago] = await prisma.$transaction([
    prisma.ferreteria.update({ where: { id: ferreteriaId }, data: { vigenciaHasta: nuevaVigencia } }),
    prisma.pagoPlataforma.create({
      data: {
        ferreteriaId,
        fecha: datos.fecha,
        monto,
        esGratis: datos.esGratis ?? false,
        vigenciaDesde: base,
        vigenciaHasta: nuevaVigencia,
        registradoPorId: usuarioQueEjecuta,
      },
    }),
  ]);

  await auditar({
    accion: "PAGO_PLATAFORMA_REGISTRA",
    usuarioId: usuarioQueEjecuta,
    ferreteriaId,
    entidad: "PagoPlataforma",
    entidadId: pago.id,
    detalle: { fecha: datos.fecha.toISOString(), monto, esGratis: datos.esGratis ?? false, vigenciaHasta: nuevaVigencia.toISOString() },
  });

  return pago;
}

// Edita un pago existente (fecha, monto, si es gratis, o la vigencia que
// otorgó) y recalcula la vigencia cacheada de la ferretería a partir de
// TODOS sus pagos — no asume que el editado sea el más reciente.
export async function editarPagoPlataforma(
  ferreteriaId: string,
  pagoId: string,
  datos: { fecha: Date; monto?: number; esGratis?: boolean; vigenciaHasta: Date },
  usuarioQueEjecuta: string,
) {
  const existente = await prisma.pagoPlataforma.findUnique({ where: { id: pagoId } });
  if (!existente || existente.ferreteriaId !== ferreteriaId) throw new EntidadNoEncontradaError("Pago no encontrado.");

  const monto = datos.esGratis ? null : (datos.monto ?? null);

  await prisma.pagoPlataforma.update({
    where: { id: pagoId },
    data: {
      fecha: datos.fecha,
      monto,
      esGratis: datos.esGratis ?? false,
      vigenciaHasta: datos.vigenciaHasta,
    },
  });

  await recalcularVigenciaCacheada(existente.ferreteriaId);

  await auditar({
    accion: "PAGO_PLATAFORMA_EDITA",
    usuarioId: usuarioQueEjecuta,
    ferreteriaId: existente.ferreteriaId,
    entidad: "PagoPlataforma",
    entidadId: pagoId,
    detalle: { fecha: datos.fecha.toISOString(), monto, esGratis: datos.esGratis ?? false, vigenciaHasta: datos.vigenciaHasta.toISOString() },
  });
}
