import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { sesionSigueValida } from "@/lib/validar-sesion";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

// Guardia de todo lo que cuelga de (app): sin sesión, con una sesión vieja
// (contraseña cambiada o membresía revocada después de emitido el token),
// o sin una ferretería activa todavía, no se entra al contenido.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const valida = await sesionSigueValida({
    id: session.user.id,
    emitidoEn: session.user.emitidoEn,
    ferreteriaId: session.user.ferreteriaId,
    rol: session.user.rol,
    isSuperAdmin: session.user.isSuperAdmin,
  });
  if (!valida) redirect("/login");

  // Un Super Admin puro (sin ferretería prestada en modo soporte) no
  // necesita elegir ninguna — su panel es de plataforma, no de negocio
  // (fuera de alcance de esta fase). Cualquier otro usuario sin ferretería
  // activa todavía (0 o ≥2 membresías) va al selector.
  if (!session.user.ferreteriaId && !session.user.isSuperAdmin) {
    redirect("/seleccionar-ferreteria");
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar rol={session.user.rol} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header
          email={session.user.email ?? ""}
          ferreteriaId={session.user.ferreteriaId}
          ferreteriaNombre={session.user.ferreteriaNombre}
          rol={session.user.rol}
          soporte={session.user.soporte}
          isSuperAdmin={session.user.isSuperAdmin}
        />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-8">{children}</main>
      </div>
    </div>
  );
}
