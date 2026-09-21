import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { auditar } from "@/lib/auditoria";
import { EstadoInvalidoError, EntidadNoEncontradaError } from "@/lib/errores-dominio";
import type { RolFerreteria } from "@prisma/client";

export type UsuarioFerreteria = {
  id: string; // id de FerreteriaUsuario (la membresía) — no el id de Usuario
  usuarioId: string;
  nombre: string | null;
  email: string;
  rol: RolFerreteria;
  estadoMembresia: "ACTIVO" | "INACTIVO";
  estadoUsuario: "INVITADO" | "ACTIVO" | "BLOQUEADO" | "INACTIVO";
};

export async function listarUsuariosFerreteria(ferreteriaId: string): Promise<UsuarioFerreteria[]> {
  const membresias = await prisma.ferreteriaUsuario.findMany({
    where: { ferreteriaId },
    include: { usuario: true },
    orderBy: { createdAt: "asc" },
  });
  return membresias.map((m) => ({
    id: m.id,
    usuarioId: m.usuarioId,
    nombre: m.usuario.name,
    email: m.usuario.email,
    rol: m.rol,
    estadoMembresia: m.estado,
    estadoUsuario: m.usuario.estado,
  }));
}

async function contarDuenosActivos(ferreteriaId: string, excluirMembresiaId?: string): Promise<number> {
  return prisma.ferreteriaUsuario.count({
    where: {
      ferreteriaId,
      rol: "DUENO",
      estado: "ACTIVO",
      ...(excluirMembresiaId ? { id: { not: excluirMembresiaId } } : {}),
    },
  });
}

// Alta de un miembro nuevo. Sin envío de mail: el Dueño elige la
// contraseña temporal acá mismo y se la pasa a la persona por fuera del
// sistema (de palabra, WhatsApp, lo que sea) — queda en la persona
// cambiarla después desde "Mi cuenta". Si el email ya existe como Usuario
// (porque trabaja en otra ferretería, o porque ya fue miembro de esta y
// lo habían desactivado) no se crea un Usuario duplicado ni se le toca la
// contraseña que ya tiene — se reusa el que hay y solo se crea/reactiva
// la membresía.
export async function crearUsuario(
  ferreteriaId: string,
  datos: { email: string; nombre: string; rol: RolFerreteria; password: string },
) {
  const email = datos.email.toLowerCase().trim();

  const usuario = await prisma.usuario.findUnique({ where: { email } });

  if (usuario) {
    const yaEsMiembro = await prisma.ferreteriaUsuario.findUnique({
      where: { ferreteriaId_usuarioId: { ferreteriaId, usuarioId: usuario.id } },
    });
    if (yaEsMiembro?.estado === "ACTIVO") {
      throw new EstadoInvalidoError("Esa persona ya es parte de esta ferretería.");
    }
    const membresia = yaEsMiembro
      ? await prisma.ferreteriaUsuario.update({ where: { id: yaEsMiembro.id }, data: { estado: "ACTIVO", rol: datos.rol } })
      : await prisma.ferreteriaUsuario.create({ data: { ferreteriaId, usuarioId: usuario.id, rol: datos.rol, estado: "ACTIVO" } });

    await auditar({
      accion: "USUARIO_CREA",
      ferreteriaId,
      entidad: "FerreteriaUsuario",
      entidadId: membresia.id,
      detalle: { email, rol: datos.rol, reactivado: !!yaEsMiembro },
    });
    return membresia;
  }

  const passwordHash = await bcrypt.hash(datos.password, 12);
  const nuevoUsuario = await prisma.usuario.create({
    data: { email, name: datos.nombre, estado: "ACTIVO", passwordHash },
  });

  const membresia = await prisma.ferreteriaUsuario.create({
    data: { ferreteriaId, usuarioId: nuevoUsuario.id, rol: datos.rol, estado: "ACTIVO" },
  });

  await auditar({
    accion: "USUARIO_CREA",
    ferreteriaId,
    entidad: "FerreteriaUsuario",
    entidadId: membresia.id,
    detalle: { email, rol: datos.rol },
  });

  return membresia;
}

export async function cambiarRolUsuario(
  ferreteriaId: string,
  membresiaId: string,
  nuevoRol: RolFerreteria,
  usuarioQueEjecuta: string,
) {
  const membresia = await prisma.ferreteriaUsuario.findUnique({ where: { id: membresiaId } });
  if (!membresia || membresia.ferreteriaId !== ferreteriaId) throw new EntidadNoEncontradaError("Usuario no encontrado.");

  if (membresia.rol === "DUENO" && nuevoRol !== "DUENO") {
    const otrosDuenos = await contarDuenosActivos(ferreteriaId, membresiaId);
    if (otrosDuenos === 0) throw new EstadoInvalidoError("Tiene que quedar al menos un Dueño activo en la ferretería.");
  }

  const actualizada = await prisma.ferreteriaUsuario.update({ where: { id: membresiaId }, data: { rol: nuevoRol } });
  await auditar({
    accion: "USUARIO_ROL_CAMBIA",
    usuarioId: usuarioQueEjecuta,
    ferreteriaId,
    entidad: "FerreteriaUsuario",
    entidadId: membresiaId,
    detalle: { rolAnterior: membresia.rol, rolNuevo: nuevoRol },
  });
  return actualizada;
}

// Desactivar/reactivar es la baja lógica de la membresía (no se borra el
// Usuario: puede tener historial de ventas/compras registradas y puede
// ser miembro de otra ferretería). sesionSigueValida() ya revisa el
// estado de la membresía en cada request, así que desactivar a alguien
// lo saca de una sesión activa en el momento, no recién en su próximo login.
export async function cambiarEstadoMembresia(
  ferreteriaId: string,
  membresiaId: string,
  nuevoEstado: "ACTIVO" | "INACTIVO",
  usuarioQueEjecuta: string,
) {
  const membresia = await prisma.ferreteriaUsuario.findUnique({ where: { id: membresiaId } });
  if (!membresia || membresia.ferreteriaId !== ferreteriaId) throw new EntidadNoEncontradaError("Usuario no encontrado.");

  if (membresia.usuarioId === usuarioQueEjecuta && nuevoEstado === "INACTIVO") {
    throw new EstadoInvalidoError("No podés desactivarte a vos mismo.");
  }

  if (nuevoEstado === "INACTIVO" && membresia.rol === "DUENO") {
    const otrosDuenos = await contarDuenosActivos(ferreteriaId, membresiaId);
    if (otrosDuenos === 0) throw new EstadoInvalidoError("Tiene que quedar al menos un Dueño activo en la ferretería.");
  }

  const actualizada = await prisma.ferreteriaUsuario.update({ where: { id: membresiaId }, data: { estado: nuevoEstado } });
  await auditar({
    accion: nuevoEstado === "INACTIVO" ? "USUARIO_DESACTIVA" : "USUARIO_REACTIVA",
    usuarioId: usuarioQueEjecuta,
    ferreteriaId,
    entidad: "FerreteriaUsuario",
    entidadId: membresiaId,
  });
  return actualizada;
}
