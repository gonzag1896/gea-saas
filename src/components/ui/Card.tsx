import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

// Reemplaza el panel con borde repetido a mano en formularios y en las
// tarjetas de KPI del dashboard (`border:1px solid #ddd; padding:16`).
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-md border border-border bg-surface p-4", className)} {...props} />;
}
