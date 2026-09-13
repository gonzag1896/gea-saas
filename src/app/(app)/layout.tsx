import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { sesionSigueValida } from "@/lib/validar-sesion";
import { LogoutButton } from "./logout-button";

// Guardia de todo lo que cuelga de (app): sin sesión, o con una sesión cuya
// contraseña cambió después de emitido el token, no se entra. La lógica de
// tenancy (ferretería activa, revalidar membresía) se agrega en Fase 4 —
// acá solo se verifica identidad.
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const valida = await sesionSigueValida({ id: session.user.id, emitidoEn: session.user.emitidoEn });
  if (!valida) redirect("/login");

  return (
    <div>
      <header style={{ display: "flex", justifyContent: "space-between", padding: 16, borderBottom: "1px solid #ddd" }}>
        <span>{session.user.email}</span>
        <LogoutButton />
      </header>
      <div style={{ padding: 24 }}>{children}</div>
    </div>
  );
}
