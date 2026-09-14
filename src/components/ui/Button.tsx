import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
export type ButtonSize = "sm" | "md";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:opacity-90 border border-primary",
  secondary: "bg-secondary text-secondary-foreground hover:opacity-90 border border-border",
  danger: "bg-danger text-danger-foreground hover:opacity-90 border border-danger",
  ghost: "bg-transparent text-foreground hover:bg-muted border border-transparent",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "text-sm px-2.5 py-1.5 gap-1.5",
  md: "text-sm px-4 py-2 gap-2",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

// Base de acciones del Design System: reemplaza el <button> crudo repetido
// en cada pantalla. `loading` deshabilita el botón y muestra un spinner sin
// que el consumidor tenga que coordinar `disabled` a mano.
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", loading = false, disabled, children, type = "button", ...props }, ref) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
          VARIANT_CLASSES[variant],
          SIZE_CLASSES[size],
          className,
        )}
        {...props}
      >
        {loading && <Spinner size="sm" className={variant === "primary" || variant === "danger" ? "text-current" : undefined} />}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
