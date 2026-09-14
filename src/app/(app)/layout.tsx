import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { sesionSigueValida } from "@/lib/validar-sesion";
import { tienePermiso } from "@/lib/permisos";
import { NavLink } from "@/components/ui/NavLink";
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
    <div className="min-h-screen bg-background">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4">
        <span className="text-sm text-muted-foreground">{session.user.email}</span>
        {session.user.ferreteriaId && (
          <span className="text-sm font-medium text-foreground">
            {session.user.soporte ? "Modo soporte — " : ""}
            {session.user.ferreteriaNombre} ({session.user.rol})
          </span>
        )}
        <div className="flex items-center gap-3">
          {session.user.rol && tienePermiso(session.user.rol, "auditoria", "ver") && <NavLink href="/auditoria">Auditoría</NavLink>}
          <FerreteriaSwitcher isSuperAdmin={session.user.isSuperAdmin} soporte={session.user.soporte} />
          <LogoutButton />
        </div>
      </header>
      {session.user.rol && (
        <nav className="flex flex-wrap gap-1 border-b border-border px-6 py-2">
          {tienePermiso(session.user.rol, "productos", "ver") && (
            <>
              <NavLink href="/categorias">Categorías</NavLink>
              <NavLink href="/sub-categorias">Sub Categorías</NavLink>
              <NavLink href="/marcas">Marcas</NavLink>
              <NavLink href="/productos">Productos</NavLink>
            </>
          )}
          {tienePermiso(session.user.rol, "clientes", "ver") && <NavLink href="/clientes">Clientes</NavLink>}
          {tienePermiso(session.user.rol, "proveedores", "ver") && <NavLink href="/proveedores">Proveedores</NavLink>}
          {tienePermiso(session.user.rol, "compras", "ver") && <NavLink href="/compras">Compras</NavLink>}
          {tienePermiso(session.user.rol, "ventas", "ver") && <NavLink href="/ventas">Ventas</NavLink>}
          {tienePermiso(session.user.rol, "cuentaCorriente", "ver") && <NavLink href="/cuenta-corriente">Cuenta Corriente</NavLink>}
        </nav>
      )}
      <div className="p-6">{children}</div>
    </div>
  );
}
