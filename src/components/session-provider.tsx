"use client";

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react";

// Solo hace falta para que `useSession().update()` funcione en componentes
// cliente (selector de ferretería, salir de modo soporte). El resto de la
// app sigue leyendo la sesión en el servidor con `auth()`.
export function SessionProvider({ children }: { children: React.ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>;
}
