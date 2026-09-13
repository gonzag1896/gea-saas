import type { NextAuthConfig } from "next-auth";

// Parte de la configuración de Auth.js que puede correr en el Edge Runtime:
// sin Prisma y sin bcrypt. La usará el middleware (Fase 4), que en Netlify
// se ejecuta como edge function y ahí no existen las APIs de Node que esas
// librerías necesitan.
//
// El Credentials provider real (bcrypt, rate limiting, bloqueo por
// intentos) y los callbacks que arman gymId/rol/isSuperAdmin en el token
// son Fase 3 — acá solo queda la forma, no la lógica de negocio.
export const authConfig = {
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },

  // Fuera de Vercel, Auth.js v5 no confía en el host del request y corta
  // el login con "UntrustedHost". En Netlify hace falta decírselo.
  trustHost: true,

  pages: {
    signIn: "/login",
  },

  // Se agregan en auth.ts (Fase 3): definirlos acá arrastraría bcrypt al edge.
  providers: [],

  callbacks: {},
} satisfies NextAuthConfig;
