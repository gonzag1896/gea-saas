import { forwardRef, type InputHTMLAttributes } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";

export const SearchInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, placeholder = "Buscar…", ...props }, ref) => (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <input
        ref={ref}
        type="search"
        placeholder={placeholder}
        className={cn(
          "w-full rounded-md border border-border bg-surface py-2 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground",
          "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary",
        )}
        {...props}
      />
    </div>
  ),
);
SearchInput.displayName = "SearchInput";
