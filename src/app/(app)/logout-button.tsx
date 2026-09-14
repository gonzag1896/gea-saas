import { signOut } from "@/lib/auth";
import { auditar } from "@/lib/auditoria";
import { auth } from "@/lib/auth";
import { Button } from "@/components/ui/Button";

export function LogoutButton({ className }: { className?: string }) {
  async function cerrarSesion() {
    "use server";
    const session = await auth();
    if (session?.user.id) await auditar({ accion: "LOGOUT", usuarioId: session.user.id });
    await signOut({ redirectTo: "/login" });
  }

  return (
    <form action={cerrarSesion}>
      <Button type="submit" variant="ghost" size="sm" className={className}>
        Cerrar sesión
      </Button>
    </form>
  );
}
