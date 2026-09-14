import {
  LayoutDashboard, FolderTree, FolderOpen, BadgeCheck, Package,
  Users, Truck, ShoppingCart, Receipt, Wallet, History,
} from "lucide-react";
import type { RolFerreteria } from "@prisma/client";
import { tienePermiso } from "@/lib/permisos";
import { NavLink } from "@/components/ui/NavLink";
import { FerreteriaSwitcher } from "./ferreteria-switcher";
import { LogoutButton } from "./logout-button";

function GrupoNav({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</span>
      {children}
    </div>
  );
}

const iconClass = "h-4 w-4 shrink-0";

// Nav lateral fijo de toda (app) — reemplaza el header+nav horizontal:
// más ancho útil para contenido, y agrupar Catálogo/Comercial le da
// estructura a los 9 módulos de negocio en vez de una fila que se corta.
export function Sidebar({
  rol,
  email,
  ferreteriaId,
  ferreteriaNombre,
  soporte,
  isSuperAdmin,
}: {
  rol: RolFerreteria | null | undefined;
  email: string;
  ferreteriaId: string | null;
  ferreteriaNombre: string | null | undefined;
  soporte: boolean;
  isSuperAdmin: boolean;
}) {
  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border bg-surface">
      <div className="px-5 py-5">
        <span className="text-lg font-bold tracking-tight text-foreground">GEA</span>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3">
        <NavLink href="/dashboard" icon={<LayoutDashboard className={iconClass} />}>Dashboard</NavLink>

        {rol && tienePermiso(rol, "productos", "ver") && (
          <GrupoNav titulo="Catálogo">
            <NavLink href="/categorias" icon={<FolderTree className={iconClass} />}>Categorías</NavLink>
            <NavLink href="/sub-categorias" icon={<FolderOpen className={iconClass} />}>Sub Categorías</NavLink>
            <NavLink href="/marcas" icon={<BadgeCheck className={iconClass} />}>Marcas</NavLink>
            <NavLink href="/productos" icon={<Package className={iconClass} />}>Productos</NavLink>
          </GrupoNav>
        )}

        {rol && (tienePermiso(rol, "clientes", "ver") || tienePermiso(rol, "proveedores", "ver") || tienePermiso(rol, "compras", "ver") || tienePermiso(rol, "ventas", "ver") || tienePermiso(rol, "cuentaCorriente", "ver")) && (
          <GrupoNav titulo="Comercial">
            {tienePermiso(rol, "clientes", "ver") && <NavLink href="/clientes" icon={<Users className={iconClass} />}>Clientes</NavLink>}
            {tienePermiso(rol, "proveedores", "ver") && <NavLink href="/proveedores" icon={<Truck className={iconClass} />}>Proveedores</NavLink>}
            {tienePermiso(rol, "compras", "ver") && <NavLink href="/compras" icon={<ShoppingCart className={iconClass} />}>Compras</NavLink>}
            {tienePermiso(rol, "ventas", "ver") && <NavLink href="/ventas" icon={<Receipt className={iconClass} />}>Ventas</NavLink>}
            {tienePermiso(rol, "cuentaCorriente", "ver") && <NavLink href="/cuenta-corriente" icon={<Wallet className={iconClass} />}>Cuenta Corriente</NavLink>}
          </GrupoNav>
        )}

        {rol && tienePermiso(rol, "auditoria", "ver") && (
          <NavLink href="/auditoria" icon={<History className={iconClass} />}>Auditoría</NavLink>
        )}
      </nav>

      <div className="flex flex-col gap-2 border-t border-border p-4">
        <div className="text-sm">
          <p className="truncate font-medium text-foreground">{email}</p>
          {ferreteriaId && (
            <p className="truncate text-xs text-muted-foreground">
              {soporte ? "Modo soporte — " : ""}
              {ferreteriaNombre} {rol ? `(${rol})` : ""}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <FerreteriaSwitcher isSuperAdmin={isSuperAdmin} soporte={soporte} className="w-full justify-start px-2" />
          <LogoutButton className="w-full justify-start px-2" />
        </div>
      </div>
    </aside>
  );
}
