"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";
import {
  LayoutDashboard, FolderTree, FolderOpen, BadgeCheck, Package,
  Users, Truck, ShoppingCart, Receipt, Wallet, ArrowLeftRight, PackageSearch, Banknote, Tags,
  PanelLeftClose, PanelLeftOpen, Settings, ChevronDown, UserCog,
} from "lucide-react";
import type { RolFerreteria } from "@prisma/client";
import { tienePermiso } from "@/lib/permisos";
import { NavLink } from "@/components/ui/NavLink";
import { cn } from "@/lib/cn";

const COLLAPSE_KEY = "gea:sidebar-colapsado";

function GrupoNav({
  titulo,
  collapsed,
  children,
  isExpanded,
  onToggle,
  icon,
}: {
  titulo: string
  collapsed: boolean
  children: React.ReactNode
  isExpanded: boolean
  onToggle: () => void
  icon: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-bold transition-colors cursor-pointer",
          collapsed && "justify-center px-0",
          "bg-white/5",
          isExpanded
            ? "text-sidebar-foreground-active bg-white/10"
            : "text-sidebar-foreground hover:bg-white/15 hover:text-sidebar-foreground-active",
        )}
      >
        {icon}
        {!collapsed && (
          <>
            <span className="flex-1 text-left">{titulo}</span>
            <ChevronDown
              className={cn(
                "h-4 w-4 transition-transform duration-200",
                isExpanded && "rotate-180"
              )}
            />
          </>
        )}
      </button>
      {!collapsed && isExpanded && (
        <div className="flex flex-col gap-0.5">{children}</div>
      )}
    </div>
  );
}

const iconClass = "h-[18px] w-[18px] shrink-0";

// Sidebar fijo de toda (app): fondo oscuro de marca, colapsable a solo
// iconos (con tooltip) y persistido en localStorage para que no "salte"
// entre navegaciones. La identidad de usuario/ferretería vive en el
// Header, no acá — separar "dónde navego" de "quién soy" es el patrón
// estándar de un SaaS con esta cantidad de secciones.
export function Sidebar({ rol }: { rol: RolFerreteria | null | undefined }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hidratado, setHidratado] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string>("");

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      // localStorage inaccesible (modo privado estricto, etc.)
    }

    // Determinar qué grupo debería estar expandido basado en la URL actual
    if (pathname.startsWith("/categorias") ||
        pathname.startsWith("/sub-categorias") ||
        pathname.startsWith("/marcas") ||
        pathname.startsWith("/productos") ||
        pathname.startsWith("/reposicion") ||
        pathname.startsWith("/listas-precio")) {
      setExpandedGroup("catalogo");
    } else if (pathname.startsWith("/clientes") ||
               pathname.startsWith("/proveedores") ||
               pathname.startsWith("/compras") ||
               pathname.startsWith("/ventas") ||
               pathname.startsWith("/movimiento-stock") ||
               pathname.startsWith("/cuenta-corriente") ||
               pathname.startsWith("/caja")) {
      setExpandedGroup("comercial");
    } else if (pathname.startsWith("/configuracion") || pathname.startsWith("/usuarios")) {
      setExpandedGroup("sistema");
    } else {
      setExpandedGroup("");
    }
    setHidratado(true);
  }, [pathname]);

  function alternar() {
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSE_KEY, next ? "1" : "0");
      } catch {
        // idem arriba
      }
      return next;
    });
  }

  function toggleGroup(groupId: string) {
    setExpandedGroup(prev => prev === groupId ? "" : groupId);
  }

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 flex h-screen shrink-0 flex-col bg-sidebar transition-[width] duration-150",
        collapsed ? "w-[68px]" : "w-64",
        !hidratado && "invisible",
      )}
    >
      {/* El logo es transparente pero el texto del isotipo ("Gestión
          Empresarial Ágil para ferreterías") es en tinta oscura y el
          resto es azul — muy cerca del tono del sidebar oscuro para leerse
          encima sin más. Por eso esta franja tiene fondo claro propio (no
          el bg-sidebar del resto), a todo el ancho — el logo se apoya
          directo sobre esa franja, sin caja ni recorte: al ser w-full con
          object-contain, se achica solo cuando el sidebar colapsa. */}
      <div className={cn("flex items-center justify-center border-b border-sidebar-border bg-white", collapsed ? "px-2 py-3" : "px-4 py-4")}>
        <Image
          src="/logo-gea.png"
          alt="GEA"
          width={1774}
          height={887}
          priority
          className="h-auto w-full object-contain"
        />
      </div>

      {/* Nav sin scroll: las secciones se expanden/contraen según necesidad */}
      <nav className="flex flex-1 flex-col gap-2 px-3 py-4">
        <NavLink href="/dashboard" icon={<LayoutDashboard className={iconClass} />} collapsed={collapsed}>Dashboard</NavLink>

        {rol && tienePermiso(rol, "productos", "ver") && (
          <GrupoNav
            titulo="Catálogo"
            collapsed={collapsed}
            icon={<FolderTree className={iconClass} />}
            isExpanded={expandedGroup === "catalogo"}
            onToggle={() => toggleGroup("catalogo")}
          >
            <NavLink href="/categorias" icon={<FolderTree className={iconClass} />} collapsed={collapsed}>Categorías</NavLink>
            <NavLink href="/sub-categorias" icon={<FolderOpen className={iconClass} />} collapsed={collapsed}>Familias</NavLink>
            <NavLink href="/marcas" icon={<BadgeCheck className={iconClass} />} collapsed={collapsed}>Marcas</NavLink>
            <NavLink href="/productos" icon={<Package className={iconClass} />} collapsed={collapsed}>Productos</NavLink>
            <NavLink href="/reposicion" icon={<PackageSearch className={iconClass} />} collapsed={collapsed}>Reposición</NavLink>
            {tienePermiso(rol, "listasPrecio", "ver") && <NavLink href="/listas-precio" icon={<Tags className={iconClass} />} collapsed={collapsed}>Listas de Precio</NavLink>}
          </GrupoNav>
        )}

        {rol && (tienePermiso(rol, "clientes", "ver") || tienePermiso(rol, "proveedores", "ver") || tienePermiso(rol, "compras", "ver") || tienePermiso(rol, "ventas", "ver") || tienePermiso(rol, "cuentaCorriente", "ver") || tienePermiso(rol, "cuentaProveedores", "ver") || tienePermiso(rol, "stock", "ver") || tienePermiso(rol, "caja", "ver")) && (
          <GrupoNav
            titulo="Comercial"
            collapsed={collapsed}
            icon={<ShoppingCart className={iconClass} />}
            isExpanded={expandedGroup === "comercial"}
            onToggle={() => toggleGroup("comercial")}
          >
            {tienePermiso(rol, "clientes", "ver") && <NavLink href="/clientes" icon={<Users className={iconClass} />} collapsed={collapsed}>Clientes</NavLink>}
            {tienePermiso(rol, "proveedores", "ver") && <NavLink href="/proveedores" icon={<Truck className={iconClass} />} collapsed={collapsed}>Proveedores</NavLink>}
            {tienePermiso(rol, "compras", "ver") && <NavLink href="/compras" icon={<ShoppingCart className={iconClass} />} collapsed={collapsed}>Compras</NavLink>}
            {tienePermiso(rol, "ventas", "ver") && <NavLink href="/ventas" icon={<Receipt className={iconClass} />} collapsed={collapsed}>Ventas</NavLink>}
            {tienePermiso(rol, "stock", "ver") && <NavLink href="/movimiento-stock" icon={<ArrowLeftRight className={iconClass} />} collapsed={collapsed}>Movimiento de Stock</NavLink>}
            {tienePermiso(rol, "cuentaCorriente", "ver") && <NavLink href="/cuenta-corriente" icon={<Wallet className={iconClass} />} collapsed={collapsed}>Cuenta Corriente</NavLink>}
            {tienePermiso(rol, "cuentaProveedores", "ver") && <NavLink href="/cuenta-corriente-proveedores" icon={<Wallet className={iconClass} />} collapsed={collapsed}>CC Proveedores</NavLink>}
            {tienePermiso(rol, "caja", "ver") && <NavLink href="/caja" icon={<Banknote className={iconClass} />} collapsed={collapsed}>Caja</NavLink>}
          </GrupoNav>
        )}

        {rol && (tienePermiso(rol, "configuracion", "ver") || tienePermiso(rol, "usuarios", "ver")) && (
          <GrupoNav
            titulo="Sistema"
            collapsed={collapsed}
            icon={<Settings className={iconClass} />}
            isExpanded={expandedGroup === "sistema"}
            onToggle={() => toggleGroup("sistema")}
          >
            {tienePermiso(rol, "usuarios", "ver") && <NavLink href="/usuarios" icon={<UserCog className={iconClass} />} collapsed={collapsed}>Usuarios</NavLink>}
            {tienePermiso(rol, "configuracion", "ver") && <NavLink href="/configuracion" icon={<Settings className={iconClass} />} collapsed={collapsed}>Configuración</NavLink>}
          </GrupoNav>
        )}
      </nav>

      <div className={cn("border-t border-sidebar-border p-3", collapsed && "flex justify-center")}>
        <button
          type="button"
          onClick={alternar}
          className={cn(
            "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-white/10 hover:text-sidebar-foreground-active",
            collapsed && "justify-center px-0"
          )}
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed ? <PanelLeftOpen className={iconClass} /> : <PanelLeftClose className={iconClass} />}
          {!collapsed && "Colapsar"}
        </button>
      </div>
    </aside>
  );
}
