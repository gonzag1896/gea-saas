import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type AlertVariant = "error" | "success" | "info";

const VARIANT_CLASSES: Record<AlertVariant, string> = {
  error: "bg-danger/10 text-danger border-danger/20",
  success: "bg-success/10 text-success border-success/20",
  info: "bg-muted text-muted-foreground border-border",
};

export interface AlertProps extends HTMLAttributes<HTMLParagraphElement> {
  variant?: AlertVariant;
}

// Reemplaza el idioma repetido `{error && <p style={{color:"crimson"}}>}`
// presente en 8+ pantallas.
export function Alert({ className, variant = "error", role, ...props }: AlertProps) {
  return (
    <p
      role={role ?? (variant === "error" ? "alert" : "status")}
      className={cn("rounded-md border px-3 py-2 text-sm", VARIANT_CLASSES[variant], className)}
      {...props}
    />
  );
}
