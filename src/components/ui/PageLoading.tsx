import { Spinner } from "./Spinner";

// Reemplaza el <p>Cargando…</p> repetido en cada pantalla que espera datos
// antes del primer render.
export function PageLoading({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-12 text-muted-foreground">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}
