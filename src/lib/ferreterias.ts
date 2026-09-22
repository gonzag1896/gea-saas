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

  return ferreterias.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    slug: f.slug,
    estado: f.estado,
    createdAt: f.createdAt,
    vigenciaHasta: f.vigenciaHasta,
    cantidadUsuarios: f._count.usuarios,
    cantidadProductos: f._count.productos,
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
    vigenciaDesde: p.vigenciaDesde,
    vigenciaHasta: p.vigenciaHasta,
    registradoPorNombre: p.registradoPor ? (p.registradoPor.name ?? p.registradoPor.email) : null,
  }));
}

// Registra un cobro de la mensualidad y extiende la vigencia un mes desde
// donde correspondía: si la ferretería todavía tenía vigencia futura, se
// suma sobre esa fecha (pagar antes de que venza no "pierde" los días que
// ya estaban pagos); si ya había vencido (o nunca tuvo), se cuenta un mes
// desde la fecha del pago.
export async function registrarPagoPlataforma(
  ferreteriaId: string,
  datos: { fecha: Date; monto?: number },
  usuarioQueEjecuta: string,
) {
  const ferreteria = await prisma.ferreteria.findUnique({ where: { id: ferreteriaId } });
  if (!ferreteria) throw new EntidadNoEncontradaError("Ferretería no encontrada.");

  const vigenciaPrevia = ferreteria.vigenciaHasta;
  const base = vigenciaPrevia && vigenciaPrevia.getTime() > datos.fecha.getTime() ? vigenciaPrevia : datos.fecha;
  const nuevaVigencia = sumarUnMes(base);

  const [, pago] = await prisma.$transaction([
    prisma.ferreteria.update({ where: { id: ferreteriaId }, data: { vigenciaHasta: nuevaVigencia } }),
    prisma.pagoPlataforma.create({
      data: {
        ferreteriaId,
        fecha: datos.fecha,
        monto: datos.monto,
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
    detalle: { fecha: datos.fecha.toISOString(), monto: datos.monto, vigenciaHasta: nuevaVigencia.toISOString() },
  });

  return pago;
}
