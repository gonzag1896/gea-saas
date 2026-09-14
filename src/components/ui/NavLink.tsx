"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// Link de navegación del chrome de la app, con resaltado de la sección
// activa. `icon` recibe el elemento ya renderizado (`<LayoutDashboard/>`),
// no el componente — un componente de ícono no es serializable cruzando
// el límite Server→Client, un elemento ya renderizado sí.
export function NavLink({ href, children, icon }: { href: string; children: ReactNode; icon?: ReactNode }) {
  const pathname = usePathname();
  const activo = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        activo ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
      )}
    >
      {icon}
      {children}
    </Link>
  );
}
