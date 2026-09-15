import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "success" | "icon";
export type ButtonSize = "sm" | "md";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90 border border-primary focus-visible:ring-primary/40",
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70 border border-border focus-visible:ring-primary/40",
  outline: "bg-transparent text-foreground border border-border hover:bg-muted focus-visible:ring-primary/40",
  ghost: "bg-transparent text-foreground hover:bg-muted border border-transparent focus-visible:ring-primary/40",
  danger: "bg-danger text-danger-foreground hover:bg-danger/90 border border-danger focus-visible:ring-danger/40",
  success: "bg-success text-success-foreground hover:bg-success/90 border border-success focus-visible:ring-success/40",
  icon: "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent focus-visible:ring-primary/40",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "text-sm px-2.5 py-1.5 gap-1.5",
  md: "text-sm px-4 py-2 gap-2",
};

const ICON_ONLY_SIZE = "h-9 w-9 p-0 shrink-0";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

const LOADING_SPINS_LIGHT: ButtonVariant[] = ["primary", "danger", "success"];

// Base de acciones del Design System: reemplaza el <button> crudo repetido
// en cada pantalla. `loading` deshabilita el botón y muestra un spinner sin
// que el consumidor tenga que coordinar `disabled` a mano. `variant="icon"`
// es un botón cuadrado sin texto (acciones de fila en tablas, toggles del
// header) — no lleva padding horizontal de más.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading = false, disabled, children, type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed",
          VARIANT_CLASSES[variant],
          variant === "icon" ? ICON_ONLY_SIZE : SIZE_CLASSES[size],
          className,
        )}
        {...props}
      >
        {loading && <Spinner size="sm" className={LOADING_SPINS_LIGHT.includes(variant) ? "text-current" : undefined} />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
