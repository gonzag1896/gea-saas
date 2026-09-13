import type { RolFerreteria } from "@prisma/client";
import { auth } from "@/lib/auth";
import { sesionSigueValida } from "@/lib/validar-sesion";

export type ContextoTenant = {
  usuarioId: string;
  ferreteriaId: string;
  ferreteriaNombre: string;
  rol: RolFerreteria;
  isSuperAdmin: boolean;
  soporte: boolean;
};

// Punto único para que un Route Handler sepa "quién pide esto y de qué
// ferretería" — nunca de un parámetro del body/query, siempre de la
// sesión validada en servidor. Devuelve null ante cualquier motivo de
// rechazo (sin sesión, sesión vieja, sin ferretería activa): a un Route
// Handler no le importa cuál fue — todas terminan en 401/403 — la
// distinción para decidir a qué pantalla mandar a alguien es cosa de los
// layouts (ver src/app/(app)/layout.tsx), no de acá.
export async function obtenerContextoTenant(): Promise<ContextoTenant | null> {
  const session = await auth();
  if (!session?.user) return null;

  const valida = await sesionSigueValida({
    id: session.user.id,
    emitidoEn: session.user.emitidoEn,
    ferreteriaId: session.user.ferreteriaId,
    rol: session.user.rol,
    isSuperAdmin: session.user.isSuperAdmin,
  });
  if (!valida) return null;

  if (!session.user.ferreteriaId || !session.user.rol) return null;

  return {
    usuarioId: session.user.id,
    ferreteriaId: session.user.ferreteriaId,
    ferreteriaNombre: session.user.ferreteriaNombre ?? "",
    rol: session.user.rol,
    isSuperAdmin: session.user.isSuperAdmin,
    soporte: session.user.soporte,
  };
}
