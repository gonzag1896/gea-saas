import { Skeleton } from "./Skeleton";

// Esqueleto genérico usado por el loading.tsx de cada ruta: cabecera de
// página + una "tarjeta" opcional (formulario) + filas de tabla pulsantes.
// Una sola forma para todas las pantallas de listado/detalle — no vale la
// pena un esqueleto a medida por pantalla, la silueta genérica ya evita el
// flash en blanco que es lo único que importa acá.
export function TableSkeleton({ withCard = true, rows = 5 }: { withCard?: boolean; rows?: number }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-48" />
      </div>

      {withCard && (
        <div className="rounded-md border border-border bg-surface p-4">
          <div className="flex flex-wrap gap-3">
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-9 w-40" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-md border border-border">
        <Skeleton className="h-9 w-full rounded-none" />
        <div className="divide-y divide-border">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-3">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/6" />
              <Skeleton className="h-4 w-1/6" />
              <Skeleton className="h-4 w-1/6" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
