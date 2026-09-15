"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Tooltip } from "./Tooltip";

// Link de navegación del sidebar (fondo oscuro), con resaltado de la
// sección activa. `icon` recibe el elemento ya renderizado
// (`<LayoutDashboard/>`), no el componente — un componente de ícono no es
// serializable cruzando el límite Server→Client cuando el sidebar se
// arma en un Server Component. `collapsed` oculta el texto y muestra un
// tooltip al hover/foco en su lugar.
export function NavLink({
  href,
  children,
  icon,
  collapsed = false,
}: {
  href: string;
  children: ReactNode;
  icon?: ReactNode;
  collapsed?: boolean;
}) {
  const pathname = usePathname();
  const activo = pathname === href || pathname.startsWith(`${href}/`);

  const link = (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        collapsed && "justify-center px-0",
        activo
          ? "bg-primary text-sidebar-foreground-active"
          : "text-sidebar-foreground hover:bg-white/10 hover:text-sidebar-foreground-active",
      )}
    >
      {icon}
      {!collapsed && <span className="truncate">{children}</span>}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip label={typeof children === "string" ? children : ""} className="w-full">
        {link}
      </Tooltip>
    );
  }
  return link;
}
