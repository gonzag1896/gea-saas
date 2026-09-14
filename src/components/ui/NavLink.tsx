"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// Link de navegación del chrome de la app, con resaltado de la sección
// activa — el nav actual no distingue en qué pantalla está parado el
// usuario.
export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();
  const activo = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        activo ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-muted",
      )}
    >
      {children}
    </Link>
  );
}
