import { prisma } from "@/lib/db";

// El JWT vive por su cuenta hasta vencer (7 días) sin volver a mirar la
// base. Sin este chequeo, resetear la contraseña de alguien por sospecha
// no lo saca de la app: su sesión sigue funcionando hasta que expire sola.
//
// La revalidación de membresía a la ferretería activa (por si el Dueño le
// sacó el acceso a un empleado a mitad de sesión) se agrega en Fase 4,
// cuando exista más de una ferretería y un selector entre ellas.
export async function sesionSigueValida(usuario: { id: string; emitidoEn: number }): Promise<boolean> {
  const dbUser = await prisma.usuario.findUnique({
    where: { id: usuario.id },
    select: { passwordCambiadoAt: true, estado: true },
  });

  if (!dbUser) return false;
  if (dbUser.estado === "BLOQUEADO" || dbUser.estado === "INACTIVO") return false;

  // Margen chico: evita que el propio cambio de contraseña te eche a vos
  // mismo por diferencias de reloj entre la app y la base.
  const MARGEN_MS = 5000;
  if (dbUser.passwordCambiadoAt && dbUser.passwordCambiadoAt.getTime() - MARGEN_MS > usuario.emitidoEn) {
    return false;
  }

  return true;
}
