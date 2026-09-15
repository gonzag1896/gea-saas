import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const input = (
      <input
        ref={ref}
        type="checkbox"
        id={id}
        className={cn(
          "h-4 w-4 shrink-0 rounded border-border text-primary",
          "focus:outline-none focus:ring-2 focus:ring-primary/30",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          className,
        )}
        {...props}
      />
    );
    if (!label) return input;
    return (
      <label htmlFor={id} className="inline-flex items-center gap-2 text-sm text-foreground">
        {input}
        {label}
      </label>
    );
  },
);
Checkbox.displayName = "Checkbox";
