"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import {
  LayoutDashboard, FolderTree, FolderOpen, BadgeCheck, Package,
  Users, Truck, ShoppingCart, Receipt, Wallet,
  PanelLeftClose, PanelLeftOpen,
} from "lucide-react";
import type { RolFerreteria } from "@prisma/client";
import { tienePermiso } from "@/lib/permisos";
import { NavLink } from "@/components/ui/NavLink";
import { cn } from "@/lib/cn";

const COLLAPSE_KEY = "gea:sidebar-colapsado";

function GrupoNav({ titulo, collapsed, children }: { titulo: string; collapsed: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      {!collapsed && (
        <span className="px-3 pb-1 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/60">{titulo}</span>
      )}
      {children}
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
  const [collapsed, setCollapsed] = useState(false);
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      // localStorage inaccesible (modo privado estricto, etc.) — se
      // queda expandido, no es un caso que valga interrumpir el render.
    }
    setHidratado(true);
  }, []);

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

  return (
    <aside
      className={cn(
        "flex h-screen shrink-0 flex-col bg-sidebar transition-[width] duration-150",
        collapsed ? "w-[68px]" : "w-64",
        !hidratado && "invisible",
      )}
    >
      <div className={cn("flex items-center border-b border-sidebar-border px-4 py-4", collapsed ? "justify-center" : "justify-between")}>
        {/* El logo tiene fondo blanco opaco (no transparente) — se muestra
            en una chapa blanca propia en vez de intentar "quitarle" el
            fondo con filtros CSS, que con un PNG sin alpha no funciona. */}
        <div className={cn("flex items-center justify-center rounded-md bg-white p-1.5", collapsed ? "h-9 w-9" : "h-9")}>
          <Image
            src="/logo-gea.png"
            alt="GEA"
            width={84}
            height={32}
            priority
            className={collapsed ? "h-5 w-5 object-contain object-left" : "h-6 w-auto"}
          />
        </div>
      </div>

      {/* Sin overflow-y en el nav a propósito: con los módulos actuales
          nunca desborda verticalmente, y un overflow (aunque sea solo en
          el eje Y) obliga al navegador a clipear también el eje X — que es
          justo por donde el tooltip del modo colapsado necesita asomar. */}
      <nav className="flex flex-1 flex-col gap-5 px-3 py-4">
        <NavLink href="/dashboard" icon={<LayoutDashboard className={iconClass} />} collapsed={collapsed}>Dashboard</NavLink>

        {rol && tienePermiso(rol, "productos", "ver") && (
          <GrupoNav titulo="Catálogo" collapsed={collapsed}>
            <NavLink href="/categorias" icon={<FolderTree className={iconClass} />} collapsed={collapsed}>Categorías</NavLink>
            <NavLink href="/sub-categorias" icon={<FolderOpen className={iconClass} />} collapsed={collapsed}>Sub Categorías</NavLink>
            <NavLink href="/marcas" icon={<BadgeCheck className={iconClass} />} collapsed={collapsed}>Marcas</NavLink>
            <NavLink href="/productos" icon={<Package className={iconClass} />} collapsed={collapsed}>Productos</NavLink>
          </GrupoNav>
        )}

        {rol && (tienePermiso(rol, "clientes", "ver") || tienePermiso(rol, "proveedores", "ver") || tienePermiso(rol, "compras", "ver") || tienePermiso(rol, "ventas", "ver") || tienePermiso(rol, "cuentaCorriente", "ver")) && (
          <GrupoNav titulo="Comercial" collapsed={collapsed}>
            {tienePermiso(rol, "clientes", "ver") && <NavLink href="/clientes" icon={<Users className={iconClass} />} collapsed={collapsed}>Clientes</NavLink>}
            {tienePermiso(rol, "proveedores", "ver") && <NavLink href="/proveedores" icon={<Truck className={iconClass} />} collapsed={collapsed}>Proveedores</NavLink>}
            {tienePermiso(rol, "compras", "ver") && <NavLink href="/compras" icon={<ShoppingCart className={iconClass} />} collapsed={collapsed}>Compras</NavLink>}
            {tienePermiso(rol, "ventas", "ver") && <NavLink href="/ventas" icon={<Receipt className={iconClass} />} collapsed={collapsed}>Ventas</NavLink>}
            {tienePermiso(rol, "cuentaCorriente", "ver") && <NavLink href="/cuenta-corriente" icon={<Wallet className={iconClass} />} collapsed={collapsed}>Cuenta Corriente</NavLink>}
          </GrupoNav>
        )}
      </nav>

      <div className={cn("border-t border-sidebar-border p-3", collapsed && "flex justify-center")}>
        <button
          type="button"
          onClick={alternar}
          className="flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors hover:bg-white/10 hover:text-sidebar-foreground-active"
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed ? <PanelLeftOpen className={iconClass} /> : <PanelLeftClose className={iconClass} />}
          {!collapsed && "Colapsar"}
        </button>
      </div>
    </aside>
  );
}
