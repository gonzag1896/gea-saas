import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface RadioProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export const Radio = forwardRef<HTMLInputElement, RadioProps>(
  ({ className, label, id, ...props }, ref) => {
    const input = (
      <input
        ref={ref}
        type="radio"
        id={id}
        className={cn(
          "h-4 w-4 shrink-0 border-border text-primary",
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
Radio.displayName = "Radio";
