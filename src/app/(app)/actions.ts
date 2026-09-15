"use server";

import { signOut } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";
import { auth } from "@/lib/auth";

// Server Action separada (en vez de una función inline dentro de un
// Server Component) para que el Header, que es Client Component por el
// menú desplegable, pueda importarla y llamarla directo.
export async function cerrarSesion() {
  const session = await auth();
  if (session?.user.id) await auditar({ accion: "LOGOUT", usuarioId: session.user.id });
  await signOut({ redirectTo: "/login" });
}
