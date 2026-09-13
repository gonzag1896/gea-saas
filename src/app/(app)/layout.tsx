import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { sesionSigueValida } from "@/lib/validar-sesion";
import { LogoutButton } from "./logout-button";
import { FerreteriaSwitcher } from "./ferreteria-switcher";

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
    <div>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottom: "1px solid #ddd" }}>
        <span>{session.user.email}</span>
        {session.user.ferreteriaId && (
          <span>
            {session.user.soporte ? "Modo soporte — " : ""}
            {session.user.ferreteriaNombre} ({session.user.rol})
          </span>
        )}
        <div style={{ display: "flex", gap: 12 }}>
          <FerreteriaSwitcher isSuperAdmin={session.user.isSuperAdmin} soporte={session.user.soporte} />
          <LogoutButton />
        </div>
      </header>
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  );
}
