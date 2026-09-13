import { prisma } from "@/lib/db";
import type { RolFerreteria } from "@prisma/client";

// El JWT vive por su cuenta hasta vencer (7 días) sin volver a mirar la
// base. Sin este chequeo, dos cosas quedarían mal:
//
//  1. Cambiar o resetear una contraseña no echaba a nadie: si le sacabas
//     la clave a alguien por sospecha, su sesión seguía andando.
//  2. Si el Dueño le saca el acceso a un empleado a mitad de sesión (lo
//     desactiva, le cambia el rol, o lo saca de la ferretería), el token
//     viejo seguía sirviendo con el rol/ferretería que ya no le
//     corresponde hasta que expirara solo.
export async function sesionSigueValida(usuario: {
  id: string;
  emitidoEn: number;
  ferreteriaId?: string | null;
  rol?: RolFerreteria | null;
  isSuperAdmin?: boolean;
}): Promise<boolean> {
  // El Super Admin en modo soporte tiene un ferreteriaId prestado y ningún
  // FerreteriaUsuario en esa ferretería: para él no corresponde revisar
  // membresía.
  const revisarMembresia = !!usuario.ferreteriaId && !usuario.isSuperAdmin;

  const [dbUser, membresia] = await Promise.all([
    prisma.usuario.findUnique({ where: { id: usuario.id }, select: { passwordCambiadoAt: true, estado: true } }),
    revisarMembresia
      ? prisma.ferreteriaUsuario.findFirst({
          where: { usuarioId: usuario.id, ferreteriaId: usuario.ferreteriaId! },
          select: { rol: true, estado: true },
        })
      : Promise.resolve(null),
  ]);

  if (!dbUser) return false;
  if (dbUser.estado === "BLOQUEADO" || dbUser.estado === "INACTIVO") return false;

  if (revisarMembresia) {
    if (!membresia || membresia.estado !== "ACTIVO") return false;
    // El rol viaja en el token y no se vuelve a mirar hasta que vence. Si
    // cambió, el token queda diciendo algo que ya no es cierto.
    if (membresia.rol !== usuario.rol) return false;
  }

  // Margen chico: evita que el propio cambio de contraseña te eche a vos
  // mismo por diferencias de reloj entre la app y la base.
  const MARGEN_MS = 5000;
  if (dbUser.passwordCambiadoAt && dbUser.passwordCambiadoAt.getTime() - MARGEN_MS > usuario.emitidoEn) {
    return false;
  }

  return true;
}
