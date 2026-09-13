import type { NextAuthConfig, Session } from "next-auth";

// Parte de la configuración de Auth.js que puede correr en el Edge Runtime:
// sin Prisma y sin bcrypt. La usará el middleware (Fase 4), que en Netlify
// se ejecuta como edge function y ahí no existen las APIs de Node que esas
// librerías necesitan.
//
// El Credentials provider real (bcrypt, rate limiting, bloqueo por
// intentos) vive en auth.ts, que corre en Node. El callback `session` sí
// puede ir acá porque solo copia campos del token a la sesión, sin tocar
// la base — el middleware (Fase 4) lo necesita disponible en el edge.
export const authConfig = {
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },

  // Fuera de Vercel, Auth.js v5 no confía en el host del request y corta
  // el login con "UntrustedHost". En Netlify hace falta decírselo.
  trustHost: true,

  pages: {
    signIn: "/login",
  },

  // El Credentials provider se agrega en auth.ts: definirlo acá arrastraría
  // bcrypt al edge.
  providers: [],

  callbacks: {
    session({ session, token }) {
      if (session.user && token.id) {
        session.user.id = token.id as string;
        session.user.isSuperAdmin = (token.isSuperAdmin as boolean | undefined) ?? false;
        session.user.ferreteriaId = (token.ferreteriaId as string | null | undefined) ?? null;
        session.user.ferreteriaNombre = (token.ferreteriaNombre as string | null | undefined) ?? null;
        session.user.rol = (token.rol as Session["user"]["rol"]) ?? null;
        session.user.soporte = (token.soporte as boolean | undefined) ?? false;
        session.user.emitidoEn = (token.emitidoEn as number | undefined) ?? 0;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
