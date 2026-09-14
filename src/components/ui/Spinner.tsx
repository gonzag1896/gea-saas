import { cn } from "@/lib/cn";

const SIZE_CLASSES = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-9 w-9 border-[3px]",
} as const;

export function Spinner({ size = "md", className }: { size?: keyof typeof SIZE_CLASSES; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Cargando"
      className={cn("inline-block animate-spin rounded-full border-muted-foreground/30 border-t-current", SIZE_CLASSES[size], className)}
    />
  );
}
