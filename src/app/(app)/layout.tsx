import { redirect } from "next/navigation";
import { obtenerSesionValidada } from "@/lib/tenant";
import { Sidebar } from "./sidebar";
import { Header } from "./header";
import { SidebarMarginAdjuster } from "./sidebar-margin-adjuster";

// Guardia de todo lo que cuelga de (app): sin sesión, con una sesión vieja
// (contraseña cambiada o membresía revocada después de emitido el token),
// o sin una ferretería activa todavía, no se entra al contenido.
//
// Usa el mismo obtenerSesionValidada() cacheado por request que
// obtenerContextoTenant() — cada page.tsx de acá abajo lo vuelve a llamar,
// y sin el cache() de por medio eso eran 2 consultas de sesión de más en
// cada navegación.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await obtenerSesionValidada();
  if (!session?.user) redirect("/login");

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
      <SidebarMarginAdjuster>
        <Header
          email={session.user.email ?? ""}
          ferreteriaId={session.user.ferreteriaId}
          ferreteriaNombre={session.user.ferreteriaNombre}
          rol={session.user.rol}
          soporte={session.user.soporte}
          isSuperAdmin={session.user.isSuperAdmin}
        />
        <main className="min-w-0 flex-1 overflow-x-hidden overflow-y-auto p-8">{children}</main>
      </SidebarMarginAdjuster>
    </div>
  );
}
