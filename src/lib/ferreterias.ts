import { prisma } from "@/lib/db";
import { auditar } from "@/lib/auditoria";
import { crearUsuario } from "@/lib/usuarios";

export type FerreteriaConResumen = {
  id: string;
  nombre: string;
  slug: string | null;
  estado: "ACTIVO" | "INACTIVO";
  createdAt: Date;
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
