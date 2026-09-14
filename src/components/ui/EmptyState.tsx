// Reemplaza los párrafos ad hoc "Todavía no hay X" repetidos por pantalla.
export function EmptyState({ message }: { message: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{message}</p>;
}
