import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

// El className del consumidor (típicamente un ancho máximo) va en el
// wrapper, no en el <select> — el select siempre llena ese wrapper.
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => (
    <div className={cn("relative", className)}>
      <select
        ref={ref}
        aria-invalid={error || undefined}
        className={cn(
          "w-full appearance-none rounded-md border bg-surface px-3 py-2 pr-8 text-sm text-foreground",
          "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          error ? "border-danger focus:ring-danger/30 focus:border-danger" : "border-border",
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  ),
);
Select.displayName = "Select";
