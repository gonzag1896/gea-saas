import { cn } from "@/lib/cn";

// Bloque base para los esqueletos de carga de cada loading.tsx.
// `motion-safe:` a propósito: sin el pulso para quien pidió menos
// movimiento en su sistema, pero igual visible como placeholder.
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("motion-safe:animate-pulse rounded-md bg-muted", className)} />;
}
