import { cache as reactCache } from "react";
import type { RolFerreteria } from "@prisma/client";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sesionSigueValida } from "@/lib/validar-sesion";
import { tienePermiso, type Modulo, type Accion } from "@/lib/permisos";

// Bajo Vitest (Node plano, sin la condición "react-server" que usa Next
// para Server Components) react no exporta cache() — queda undefined. El
// fallback identidad mantiene el comportamiento correcto en los tests
// (sin memoizar, pero sin romper); en runtime de Next sí memoiza.
const memoPorRequest = reactCache ?? (<T,>(fn: T): T => fn);

// `auth()` ya viene deduplicado por request (Auth.js v5 lo envuelve en
// cache() internamente), pero sesionSigueValida() no — son 2 consultas a
// la base cada vez. Sin este cache(), layout.tsx (guardia de toda (app))
// y el page.tsx de cada pantalla la llamaban cada uno por su cuenta: 4
// consultas de sesión en cada navegación en vez de 2. Al no recibir
// argumentos, React cache() lo memoiza una sola vez por request sin
// importar cuántos Server Components lo llamen.
export const obtenerSesionValidada = memoPorRequest(async () => {
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

  return session;
});

// Estado de acceso de la ferretería: la inhabilita el administrador de la
// plataforma (falta de pago) con Ferreteria.estado = INACTIVO. Se consulta una
// vez por request (cache) y la comparten el layout, que muestra el mensaje de
// cuota vencida, y la autorización de las APIs, que rechazan todo.
export const obtenerAccesoFerreteria = memoPorRequest(async (ferreteriaId: string) => {
  const ferreteria = await prisma.ferreteria.findUnique({
    where: { id: ferreteriaId },
    select: { estado: true, vigenciaHasta: true },
  });
  if (!ferreteria) return null;
  return { inhabilitada: ferreteria.estado === "INACTIVO", vigenciaHasta: ferreteria.vigenciaHasta };
});

export type ContextoTenant = {
  usuarioId: string;
  ferreteriaId: string;
  ferreteriaNombre: string;
  rol: RolFerreteria;
  isSuperAdmin: boolean;
  soporte: boolean;
  // La ferretería tiene el acceso inhabilitado (cuota vencida). Nunca es
  // true para el Super Admin: tiene que poder entrar a verla (modo soporte).
  inhabilitada: boolean;
};

// Punto único para que un Route Handler sepa "quién pide esto y de qué
// ferretería" — nunca de un parámetro del body/query, siempre de la
// sesión validada en servidor. Devuelve null ante cualquier motivo de
// rechazo (sin sesión, sesión vieja, sin ferretería activa): a un Route
// Handler no le importa cuál fue — todas terminan en 401/403 — la
// distinción para decidir a qué pantalla mandar a alguien es cosa de los
// layouts (ver src/app/(app)/layout.tsx), no de acá.
export async function obtenerContextoTenant(): Promise<ContextoTenant | null> {
  const session = await obtenerSesionValidada();
  if (!session?.user) return null;

  if (!session.user.ferreteriaId || !session.user.rol) return null;

  const acceso = session.user.isSuperAdmin ? null : await obtenerAccesoFerreteria(session.user.ferreteriaId);

  return {
    inhabilitada: acceso?.inhabilitada ?? false,
    usuarioId: session.user.id,
    ferreteriaId: session.user.ferreteriaId,
    ferreteriaNombre: session.user.ferreteriaNombre ?? "",
    rol: session.user.rol,
    isSuperAdmin: session.user.isSuperAdmin,
    soporte: session.user.soporte,
  };
}

export type ResultadoPermiso =
  | { ok: true; contexto: ContextoTenant }
  | { ok: false; status: 401 | 403 };

// Punto único de autorización para Route Handlers: sin esto, cada ruta
// nueva tendría que acordarse de chequear la matriz de permisos por su
// cuenta. `soporte` (Super Admin impersonando) nunca escribe, aunque el
// rol prestado (Dueño) sí lo permitiría en operación normal — la
// impersonación es para mirar, no para operar en nombre de nadie.
export async function requirePermiso(modulo: Modulo, accion: Accion): Promise<ResultadoPermiso> {
  const contexto = await obtenerContextoTenant();
  if (!contexto) return { ok: false, status: 401 };

  // Ferretería con el acceso inhabilitado por falta de pago: nada pasa, ni
  // siquiera lectura, sin importar el rol.
  if (contexto.inhabilitada) return { ok: false, status: 403 };

  if (contexto.soporte && accion !== "ver") return { ok: false, status: 403 };
  if (!tienePermiso(contexto.rol, modulo, accion)) return { ok: false, status: 403 };

  return { ok: true, contexto };
}
