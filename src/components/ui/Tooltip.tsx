import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

// Tooltip puramente CSS (group-hover/focus) — no hace falta JS ni popover
// posicionado para el único caso de uso hoy: el label de un ítem de nav
// cuando el sidebar está colapsado a solo iconos.
export function Tooltip({
  label,
  children,
  className,
  side = "right",
}: {
  label: string;
  children: ReactNode;
  className?: string;
  side?: "right" | "left";
}) {
  return (
    <span className={cn("group/tooltip relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-md bg-foreground px-2 py-1 text-xs text-background",
          side === "right" ? "left-full ml-2" : "right-full mr-2",
          "opacity-0 transition-opacity delay-150 group-hover/tooltip:opacity-100 group-focus-within/tooltip:opacity-100",
          "z-50",
        )}
      >
        {label}
      </span>
    </span>
  );
}
