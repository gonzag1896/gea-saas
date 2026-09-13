import { signOut } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";
import { auth } from "@/lib/auth";

export function LogoutButton() {
  async function cerrarSesion() {
    "use server";
    const session = await auth();
    if (session?.user.id) await auditar({ accion: "LOGOUT", usuarioId: session.user.id });
    await signOut({ redirectTo: "/login" });
  }

  return (
    <form action={cerrarSesion}>
      <button type="submit">Cerrar sesión</button>
    </form>
  );
}
