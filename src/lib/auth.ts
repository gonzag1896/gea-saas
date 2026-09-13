import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { authConfig } from "@/lib/auth.config";

// Configuración completa: corre en Node, así que puede usar Prisma.
//
// FASE 3 agrega acá el Credentials provider (bcrypt + rate limiting +
// bloqueo por intentos, ver Revisión técnica final sección 5) y los
// callbacks que arman ferreteriaId/rol/isSuperAdmin en el token (ver
// Plan Maestro sección 4 y Revisión técnica final sección 4: el jwt
// callback es también donde se resuelve el cambio de ferretería activa
// vía `session.update()` y el modo impersonación del Super Admin).
//
// Por ahora `providers` queda vacío a propósito: nadie puede iniciar
// sesión todavía — es el punto de "no avanzar a Fase 3" hasta cerrar
// las fundaciones.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  providers: [],
});
