import type { RolFerreteria } from "@prisma/client";
import type { DefaultSession } from "next-auth";

// Amplía el tipo de sesión de Auth.js con los campos que necesita el resto
// de la app. Los valores reales se completan en Fase 3 (callbacks jwt/session
// en lib/auth.ts) — este archivo es solo la forma, no la lógica.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isSuperAdmin: boolean;
      ferreteriaId: string | null;
      ferreteriaNombre: string | null;
      rol: RolFerreteria | null;
      // true mientras el Super Admin está impersonando una ferretería en
      // modo soporte (solo lectura — ver Revisión técnica final, sección 5).
      soporte: boolean;
      // epoch ms de emisión del token, para compararlo contra
      // passwordCambiadoAt y cortar sesiones viejas.
      emitidoEn: number;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    isSuperAdmin?: boolean;
    ferreteriaId?: string | null;
    ferreteriaNombre?: string | null;
    rol?: RolFerreteria | null;
    soporte?: boolean;
    emitidoEn?: number;
  }
}
