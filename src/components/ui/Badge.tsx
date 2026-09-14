import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant = "neutral" | "success" | "danger" | "warning";

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  neutral: "bg-muted text-muted-foreground",
  success: "bg-success/10 text-success",
  danger: "bg-danger/10 text-danger",
  warning: "bg-warning/10 text-warning",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

// Reemplaza el texto plano usado hoy para `estado` (compras/ventas) y
// `activo` (categorías/sub-categorías/marcas/productos).
export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium", VARIANT_CLASSES[variant], className)}
      {...props}
    />
  );
}

const ESTADO_VARIANTE: Record<string, BadgeVariant> = {
  PENDIENTE: "warning",
  CONFIRMADO: "success",
  ANULADO: "danger",
};

// Para Compra.estado / Venta.estado — cualquier valor no mapeado cae en
// "neutral" en vez de romper, por si el enum crece a futuro.
export function EstadoBadge({ estado }: { estado: string }) {
  return <Badge variant={ESTADO_VARIANTE[estado] ?? "neutral"}>{estado}</Badge>;
}

// Para el flag `activo` de Categoria/SubCategoria/Marca/Producto.
export function ActivoBadge({ activo }: { activo: boolean }) {
  return <Badge variant={activo ? "success" : "neutral"}>{activo ? "Activo" : "Inactivo"}</Badge>;
}
